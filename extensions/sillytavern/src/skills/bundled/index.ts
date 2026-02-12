/**
 * Bundled Skills for SillyTavern
 *
 * This module provides built-in skills that are always available
 * without requiring external installation.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SkillEntry } from "../types.js";
import { parseSkillFile } from "../parser.js";

const fsp = fs.promises;

// Get the bundled skills directory
function getBundledSkillsDir(): string {
  // In ESM, we need to derive __dirname from import.meta.url
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  // Go up from src/skills/bundled to the extension root, then to skills/
  return path.resolve(currentDir, "..", "..", "..", "skills");
}

/**
 * List of bundled skill names
 */
export const BUNDLED_SKILL_NAMES = [
  "character-card",
  "world-info",
  "preset",
  "roleplay-assistant",
  "prompt-engineering",
  "memory-management",
  "image-generation",
  "group-chat",
  "computer-control",
  "browser-automation",
  "code-execution",
  "system-monitor",
  "file-search",
] as const;

export type BundledSkillName = (typeof BUNDLED_SKILL_NAMES)[number];

// Cache for loaded bundled skills
let bundledSkillsCache: SkillEntry[] | null = null;

/**
 * Load a single bundled skill from its SKILL.md file
 */
async function loadBundledSkill(skillName: string): Promise<SkillEntry | null> {
  const skillsDir = getBundledSkillsDir();
  const skillPath = path.join(skillsDir, skillName, "SKILL.md");

  try {
    const content = await fsp.readFile(skillPath, "utf-8");
    const skill = parseSkillFile(
      content,
      skillPath,
      path.dirname(skillPath),
      "sillytavern-bundled",
    );
    return skill;
  } catch (error) {
    console.warn(`Failed to load bundled skill "${skillName}":`, error);
    return null;
  }
}

/**
 * Load a single bundled skill synchronously
 */
function loadBundledSkillSync(skillName: string): SkillEntry | null {
  const skillsDir = getBundledSkillsDir();
  const skillPath = path.join(skillsDir, skillName, "SKILL.md");

  try {
    const content = fs.readFileSync(skillPath, "utf-8");
    const skill = parseSkillFile(
      content,
      skillPath,
      path.dirname(skillPath),
      "sillytavern-bundled",
    );
    return skill;
  } catch (error) {
    console.warn(`Failed to load bundled skill "${skillName}":`, error);
    return null;
  }
}

/**
 * Get all bundled skills (async)
 */
export async function loadBundledSkills(): Promise<SkillEntry[]> {
  const skills: SkillEntry[] = [];

  for (const skillName of BUNDLED_SKILL_NAMES) {
    const skill = await loadBundledSkill(skillName);
    if (skill) {
      skills.push(skill);
    }
  }

  return skills;
}

/**
 * Get all bundled skills (sync, uses cache)
 */
export function getBundledSkills(): SkillEntry[] {
  if (bundledSkillsCache) {
    return [...bundledSkillsCache];
  }

  const skills: SkillEntry[] = [];

  for (const skillName of BUNDLED_SKILL_NAMES) {
    const skill = loadBundledSkillSync(skillName);
    if (skill) {
      skills.push(skill);
    }
  }

  bundledSkillsCache = skills;
  return [...skills];
}

/**
 * Get a bundled skill by name
 */
export function getBundledSkill(name: string): SkillEntry | undefined {
  const skills = getBundledSkills();
  return skills.find(
    (skill) => skill.name.toLowerCase() === name.toLowerCase(),
  );
}

/**
 * Check if a skill is bundled
 */
export function isBundledSkill(name: string): boolean {
  return BUNDLED_SKILL_NAMES.some(
    (skillName) => skillName.toLowerCase() === name.toLowerCase(),
  );
}

/**
 * Clear the bundled skills cache (useful for testing or hot-reloading)
 */
export function clearBundledSkillsCache(): void {
  bundledSkillsCache = null;
}

/**
 * Get bundled skills directory path
 */
export function getBundledSkillsDirectory(): string {
  return getBundledSkillsDir();
}
