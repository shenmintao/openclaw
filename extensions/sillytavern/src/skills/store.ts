/**
 * Skills Store
 * Manages skill loading, storage, and retrieval
 */

import fs from "node:fs";
import path from "node:path";
import type {
  SkillEntry,
  SkillsIndex,
  SkillIndexEntry,
  StoredSkill,
  SkillsConfig,
  SkillStatusEntry,
  SkillSnapshot,
  SkillEligibilityContext,
} from "./types.js";
import { parseSkillFile, buildSkillsPrompt } from "./parser.js";

const fsp = fs.promises;

// Storage paths
const SILLYTAVERN_DIR = ".sillytavern";
const SKILLS_DIR = "skills";
const SKILLS_INDEX_FILE = "skills-index.json";
const SKILLS_DATA_DIR = "skills-data";

/**
 * Get the skills storage directory
 */
function getSkillsStorageDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || ".";
  return path.join(homeDir, SILLYTAVERN_DIR, SKILLS_DIR);
}

/**
 * Get the skills index file path
 */
function getSkillsIndexPath(): string {
  return path.join(getSkillsStorageDir(), SKILLS_INDEX_FILE);
}

/**
 * Get the skills data directory
 */
function getSkillsDataDir(): string {
  return path.join(getSkillsStorageDir(), SKILLS_DATA_DIR);
}

/**
 * Ensure storage directories exist
 */
async function ensureStorageDirs(): Promise<void> {
  const storageDir = getSkillsStorageDir();
  const dataDir = getSkillsDataDir();

  await fsp.mkdir(storageDir, { recursive: true });
  await fsp.mkdir(dataDir, { recursive: true });
}

/**
 * Load skills index
 */
export async function loadSkillsIndex(): Promise<SkillsIndex> {
  const indexPath = getSkillsIndexPath();

  try {
    const content = await fsp.readFile(indexPath, "utf-8");
    return JSON.parse(content) as SkillsIndex;
  } catch {
    return { version: 1, entries: [] };
  }
}

/**
 * Save skills index
 */
export async function saveSkillsIndex(index: SkillsIndex): Promise<void> {
  await ensureStorageDirs();
  const indexPath = getSkillsIndexPath();
  await fsp.writeFile(indexPath, JSON.stringify(index, null, 2), "utf-8");
}

/**
 * Load a stored skill by ID
 */
export async function loadStoredSkill(id: string): Promise<StoredSkill | null> {
  const dataDir = getSkillsDataDir();
  const skillPath = path.join(dataDir, `${id}.json`);

  try {
    const content = await fsp.readFile(skillPath, "utf-8");
    return JSON.parse(content) as StoredSkill;
  } catch {
    return null;
  }
}

/**
 * Save a stored skill
 */
export async function saveStoredSkill(skill: StoredSkill): Promise<void> {
  await ensureStorageDirs();
  const dataDir = getSkillsDataDir();
  const skillPath = path.join(dataDir, `${skill.id}.json`);
  await fsp.writeFile(skillPath, JSON.stringify(skill, null, 2), "utf-8");
}

/**
 * Delete a stored skill
 */
export async function deleteStoredSkill(id: string): Promise<void> {
  const dataDir = getSkillsDataDir();
  const skillPath = path.join(dataDir, `${id}.json`);

  try {
    await fsp.unlink(skillPath);
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Generate a unique skill ID
 */
function generateSkillId(name: string): string {
  const timestamp = Date.now();
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32);
  return `${safeName}-${timestamp}`;
}

/**
 * Import a skill from a SKILL.md file
 */
export async function importSkill(
  filePath: string,
  options?: { enabled?: boolean },
): Promise<StoredSkill> {
  const content = await fsp.readFile(filePath, "utf-8");
  const baseDir = path.dirname(filePath);
  const entry = parseSkillFile(content, filePath, baseDir, "sillytavern-local");

  const id = generateSkillId(entry.name);
  const now = new Date().toISOString();

  const storedSkill: StoredSkill = {
    id,
    name: entry.name,
    description: entry.description,
    source: entry.source,
    importedAt: now,
    filePath,
    baseDir,
    enabled: options?.enabled ?? true,
    content: entry.content,
    frontmatter: entry.frontmatter,
    metadata: entry.metadata,
  };

  // Save the skill
  await saveStoredSkill(storedSkill);

  // Update index
  const index = await loadSkillsIndex();
  const indexEntry: SkillIndexEntry = {
    id,
    name: entry.name,
    description: entry.description,
    source: entry.source,
    importedAt: now,
    enabled: storedSkill.enabled,
    emoji: entry.metadata?.emoji,
  };

  // Remove existing entry with same name
  index.entries = index.entries.filter((e) => e.name !== entry.name);
  index.entries.push(indexEntry);
  await saveSkillsIndex(index);

  return storedSkill;
}

/**
 * Load skills from a directory
 */
export async function loadSkillsFromDirectory(
  dir: string,
  source: SkillEntry["source"],
): Promise<SkillEntry[]> {
  const skills: SkillEntry[] = [];

  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const skillDir = path.join(dir, entry.name);
      const skillFile = path.join(skillDir, "SKILL.md");

      try {
        const content = await fsp.readFile(skillFile, "utf-8");
        const skill = parseSkillFile(content, skillFile, skillDir, source);
        skills.push(skill);
      } catch {
        // Skip directories without SKILL.md
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return skills;
}

/**
 * Load all enabled skills
 */
export async function loadEnabledSkills(): Promise<SkillEntry[]> {
  const index = await loadSkillsIndex();
  const enabledEntries = index.entries.filter((e) => e.enabled);
  const skills: SkillEntry[] = [];

  for (const entry of enabledEntries) {
    const stored = await loadStoredSkill(entry.id);
    if (stored) {
      skills.push({
        name: stored.name,
        description: stored.description,
        content: stored.content,
        source: stored.source as SkillEntry["source"],
        filePath: stored.filePath,
        baseDir: stored.baseDir,
        frontmatter: stored.frontmatter,
        metadata: stored.metadata,
        invocation: {
          userInvocable: true,
          disableModelInvocation: false,
        },
      });
    }
  }

  return skills;
}

/**
 * Get all skills (enabled and disabled)
 */
export async function getAllSkills(): Promise<StoredSkill[]> {
  const index = await loadSkillsIndex();
  const skills: StoredSkill[] = [];

  for (const entry of index.entries) {
    const stored = await loadStoredSkill(entry.id);
    if (stored) {
      skills.push(stored);
    }
  }

  return skills;
}

/**
 * Enable or disable a skill
 */
export async function setSkillEnabled(id: string, enabled: boolean): Promise<void> {
  const stored = await loadStoredSkill(id);
  if (!stored) {
    throw new Error(`Skill not found: ${id}`);
  }

  stored.enabled = enabled;
  await saveStoredSkill(stored);

  const index = await loadSkillsIndex();
  const entry = index.entries.find((e) => e.id === id);
  if (entry) {
    entry.enabled = enabled;
    await saveSkillsIndex(index);
  }
}

/**
 * Remove a skill
 */
export async function removeSkill(id: string): Promise<void> {
  await deleteStoredSkill(id);

  const index = await loadSkillsIndex();
  index.entries = index.entries.filter((e) => e.id !== id);
  await saveSkillsIndex(index);
}

/**
 * Check if a binary exists in PATH
 */
export function hasBinary(bin: string): boolean {
  const pathEnv = process.env.PATH || "";
  const pathSep = process.platform === "win32" ? ";" : ":";
  const paths = pathEnv.split(pathSep);
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];

  for (const dir of paths) {
    for (const ext of extensions) {
      const fullPath = path.join(dir, bin + ext);
      try {
        fs.accessSync(fullPath, fs.constants.X_OK);
        return true;
      } catch {
        // Continue checking
      }
    }
  }

  return false;
}

/**
 * Check if an environment variable is set
 */
export function hasEnvVar(name: string): boolean {
  return process.env[name] !== undefined && process.env[name] !== "";
}

/**
 * Check skill eligibility
 */
export function checkSkillEligibility(
  skill: SkillEntry,
  config?: SkillsConfig,
  eligibility?: SkillEligibilityContext,
): SkillStatusEntry {
  const requirements = skill.metadata?.requires ?? {};
  const missing = {
    bins: [] as string[],
    anyBins: [] as string[],
    env: [] as string[],
    config: [] as string[],
    os: [] as string[],
  };

  // Check required binaries
  const requiredBins = requirements.bins ?? [];
  for (const bin of requiredBins) {
    const localHas = hasBinary(bin);
    const remoteHas = eligibility?.remote?.hasBin(bin) ?? false;
    if (!localHas && !remoteHas) {
      missing.bins.push(bin);
    }
  }

  // Check anyBins (at least one required)
  const anyBins = requirements.anyBins ?? [];
  if (anyBins.length > 0) {
    const hasAny = anyBins.some((bin) => {
      const localHas = hasBinary(bin);
      const remoteHas = eligibility?.remote?.hasBin(bin) ?? false;
      return localHas || remoteHas;
    });
    if (!hasAny) {
      missing.anyBins = anyBins;
    }
  }

  // Check required environment variables
  const requiredEnv = requirements.env ?? [];
  for (const env of requiredEnv) {
    if (!hasEnvVar(env)) {
      missing.env.push(env);
    }
  }

  // Check OS requirements
  const requiredOs = requirements.os ?? [];
  if (requiredOs.length > 0) {
    const currentPlatform = process.platform;
    const remotePlatforms = eligibility?.remote?.platforms ?? [];
    const allPlatforms = [currentPlatform, ...remotePlatforms];

    const hasMatchingOs = requiredOs.some((os) => allPlatforms.includes(os));
    if (!hasMatchingOs) {
      missing.os = requiredOs;
    }
  }

  // Check if blocked by filter
  const filter = config?.filter ?? [];
  const exclude = config?.exclude ?? [];
  const blockedByAllowlist =
    (filter.length > 0 && !filter.includes(skill.name)) ||
    exclude.includes(skill.name);

  // Determine eligibility
  const hasMissing =
    missing.bins.length > 0 ||
    missing.anyBins.length > 0 ||
    missing.env.length > 0 ||
    missing.config.length > 0 ||
    missing.os.length > 0;

  const eligible = !hasMissing && !blockedByAllowlist;

  return {
    name: skill.name,
    description: skill.description,
    source: skill.source,
    filePath: skill.filePath,
    baseDir: skill.baseDir,
    skillKey: skill.metadata?.skillKey ?? skill.name,
    primaryEnv: skill.metadata?.primaryEnv,
    emoji: skill.metadata?.emoji,
    homepage: skill.metadata?.homepage,
    always: skill.metadata?.always ?? false,
    disabled: false,
    blockedByAllowlist,
    eligible,
    requirements: {
      bins: requiredBins,
      anyBins,
      env: requiredEnv,
      config: requirements.config ?? [],
      os: requiredOs,
    },
    missing,
  };
}

/**
 * Filter skills based on config and eligibility
 */
export function filterSkills(
  skills: SkillEntry[],
  config?: SkillsConfig,
  eligibility?: SkillEligibilityContext,
): SkillEntry[] {
  const filter = config?.filter ?? [];
  const exclude = config?.exclude ?? [];
  const always = config?.always ?? [];

  return skills.filter((skill) => {
    // Always include skills in the always list
    if (always.includes(skill.name) || skill.metadata?.always) {
      return true;
    }

    // Check filter list
    if (filter.length > 0 && !filter.includes(skill.name)) {
      return false;
    }

    // Check exclude list
    if (exclude.includes(skill.name)) {
      return false;
    }

    // Check eligibility
    const status = checkSkillEligibility(skill, config, eligibility);
    return status.eligible;
  });
}

/**
 * Build a skill snapshot for session
 */
export function buildSkillSnapshot(
  skills: SkillEntry[],
  config?: SkillsConfig,
): SkillSnapshot {
  const prompt = buildSkillsPrompt(skills, {
    maxTokens: config?.maxTokens ?? 4096,
  });

  return {
    prompt,
    skills: skills.map((s) => ({
      name: s.name,
      primaryEnv: s.metadata?.primaryEnv,
    })),
    version: Date.now(),
  };
}

/**
 * Get eligible skills for a session
 */
export async function getEligibleSkills(
  config?: SkillsConfig,
  eligibility?: SkillEligibilityContext,
): Promise<SkillEntry[]> {
  const enabledSkills = await loadEnabledSkills();
  const filtered = filterSkills(enabledSkills, config, eligibility);

  // Apply maxSkills limit
  const maxSkills = config?.maxSkills ?? 20;
  return filtered.slice(0, maxSkills);
}

/**
 * Scan workspace for skills
 */
export async function scanWorkspaceSkills(
  workspaceDir: string,
  config?: SkillsConfig,
): Promise<SkillEntry[]> {
  const skills: SkillEntry[] = [];

  // Scan workspace skills directory
  const workspaceSkillsDir = path.join(workspaceDir, "skills");
  const workspaceSkills = await loadSkillsFromDirectory(
    workspaceSkillsDir,
    "sillytavern-local",
  );
  skills.push(...workspaceSkills);

  // Scan extra directories
  const extraDirs = config?.extraDirs ?? [];
  for (const dir of extraDirs) {
    const extraSkills = await loadSkillsFromDirectory(dir, "sillytavern-local");
    skills.push(...extraSkills);
  }

  return skills;
}

/**
 * Sync skills from workspace to store
 */
export async function syncSkillsFromWorkspace(
  workspaceDir: string,
  config?: SkillsConfig,
): Promise<{ added: number; updated: number; removed: number }> {
  const workspaceSkills = await scanWorkspaceSkills(workspaceDir, config);
  const index = await loadSkillsIndex();

  let added = 0;
  let updated = 0;
  let removed = 0;

  // Track existing skill names
  const existingNames = new Set(index.entries.map((e) => e.name));
  const workspaceNames = new Set(workspaceSkills.map((s) => s.name));

  // Add or update skills
  for (const skill of workspaceSkills) {
    const existing = index.entries.find((e) => e.name === skill.name);

    if (existing) {
      // Update existing skill
      const stored = await loadStoredSkill(existing.id);
      if (stored) {
        stored.content = skill.content;
        stored.description = skill.description;
        stored.frontmatter = skill.frontmatter;
        stored.metadata = skill.metadata;
        await saveStoredSkill(stored);
        updated++;
      }
    } else {
      // Import new skill
      await importSkill(skill.filePath, { enabled: true });
      added++;
    }
  }

  // Remove skills that no longer exist in workspace
  for (const entry of index.entries) {
    if (entry.source === "sillytavern-local" && !workspaceNames.has(entry.name)) {
      await removeSkill(entry.id);
      removed++;
    }
  }

  return { added, updated, removed };
}
