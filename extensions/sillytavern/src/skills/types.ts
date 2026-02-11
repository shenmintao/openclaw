/**
 * SillyTavern Skills Types
 * Provides skill definitions compatible with OpenClaw's skill system
 */

/**
 * Skill install specification
 */
export interface SkillInstallSpec {
  id?: string;
  kind: "brew" | "node" | "go" | "uv" | "download";
  label?: string;
  bins?: string[];
  os?: string[];
  formula?: string;
  package?: string;
  module?: string;
  url?: string;
}

/**
 * Skill requirements
 */
export interface SkillRequirements {
  /** Required binaries (all must be present) */
  bins?: string[];
  /** Any of these binaries (at least one must be present) */
  anyBins?: string[];
  /** Required environment variables */
  env?: string[];
  /** Required config paths */
  config?: string[];
  /** Required OS platforms */
  os?: string[];
}

/**
 * OpenClaw skill metadata
 */
export interface SkillMetadata {
  /** Always include this skill */
  always?: boolean;
  /** Unique skill key */
  skillKey?: string;
  /** Primary environment variable for API key */
  primaryEnv?: string;
  /** Emoji for display */
  emoji?: string;
  /** Homepage URL */
  homepage?: string;
  /** Supported OS platforms */
  os?: string[];
  /** Skill requirements */
  requires?: SkillRequirements;
  /** Install specifications */
  install?: SkillInstallSpec[];
}

/**
 * Skill invocation policy
 */
export interface SkillInvocationPolicy {
  /** Can be invoked by user commands */
  userInvocable: boolean;
  /** Disable model-based invocation */
  disableModelInvocation: boolean;
}

/**
 * Parsed skill frontmatter
 */
export type ParsedSkillFrontmatter = Record<string, string>;

/**
 * Skill entry representing a loaded skill
 */
export interface SkillEntry {
  /** Skill name */
  name: string;
  /** Skill description */
  description: string;
  /** Skill content (markdown body) */
  content: string;
  /** Source of the skill */
  source: "sillytavern-local" | "sillytavern-managed" | "sillytavern-bundled";
  /** File path to SKILL.md */
  filePath: string;
  /** Base directory of the skill */
  baseDir: string;
  /** Parsed frontmatter */
  frontmatter: ParsedSkillFrontmatter;
  /** OpenClaw metadata */
  metadata?: SkillMetadata;
  /** Invocation policy */
  invocation?: SkillInvocationPolicy;
}

/**
 * Skill eligibility context for remote execution
 */
export interface SkillEligibilityContext {
  remote?: {
    platforms: string[];
    hasBin: (bin: string) => boolean;
    hasAnyBin: (bins: string[]) => boolean;
    note?: string;
  };
}

/**
 * Skill status entry for display
 */
export interface SkillStatusEntry {
  name: string;
  description: string;
  source: string;
  filePath: string;
  baseDir: string;
  skillKey: string;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  requirements: SkillRequirements;
  missing: {
    bins: string[];
    anyBins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
}

/**
 * Skill snapshot for session
 */
export interface SkillSnapshot {
  prompt: string;
  skills: Array<{ name: string; primaryEnv?: string }>;
  version?: number;
}

/**
 * Stored skill with metadata
 */
export interface StoredSkill {
  id: string;
  name: string;
  description: string;
  source: string;
  importedAt: string;
  filePath: string;
  baseDir: string;
  enabled: boolean;
  content: string;
  frontmatter: ParsedSkillFrontmatter;
  metadata?: SkillMetadata;
}

/**
 * Skill index entry
 */
export interface SkillIndexEntry {
  id: string;
  name: string;
  description: string;
  source: string;
  importedAt: string;
  enabled: boolean;
  emoji?: string;
}

/**
 * Skills index
 */
export interface SkillsIndex {
  version: number;
  entries: SkillIndexEntry[];
}

/**
 * Skills configuration
 */
export interface SkillsConfig {
  /** Enable skills injection */
  enabled?: boolean;
  /** Maximum skills to include */
  maxSkills?: number;
  /** Maximum tokens for skills content */
  maxTokens?: number;
  /** Skill filter (only include these skills) */
  filter?: string[];
  /** Skills to always include */
  always?: string[];
  /** Skills to exclude */
  exclude?: string[];
  /** Watch skills directory for changes */
  watch?: boolean;
  /** Extra directories to scan for skills */
  extraDirs?: string[];
}
