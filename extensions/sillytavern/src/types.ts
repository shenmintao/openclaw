/**
 * SillyTavern format type definitions
 * Based on Character Card V2/V3 specification and real SillyTavern exports
 */

// ============================================================================
// Character Card Types
// ============================================================================

/**
 * Embedded world book entry within a character card
 */
export interface CharacterBookEntry {
  keys: string[];
  content: string;
  extensions: Record<string, unknown>;
  enabled: boolean;
  insertion_order: number;
  name: string;
}

/**
 * Embedded world book (lorebook) within a character card
 */
export interface CharacterBook {
  extensions: Record<string, unknown>;
  entries: CharacterBookEntry[];
}

/**
 * Depth prompt extension for character cards
 */
export interface DepthPromptExtension {
  prompt: string;
  depth: number;
  role: "system" | "user" | "assistant";
}

/**
 * Character card extensions
 */
export interface CharacterExtensions {
  fav?: boolean;
  talkativeness?: string;
  world?: string;
  depth_prompt?: DepthPromptExtension;
  [key: string]: unknown;
}

/**
 * Character card data (V2/V3 common structure)
 */
export interface CharacterCardData {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  tags: string[];
  creator: string;
  character_version: string;
  character_book?: CharacterBook;
  extensions: CharacterExtensions;
}

/**
 * Character Card V2 format
 */
export interface CharacterCardV2 {
  spec: "chara_card_v2";
  spec_version: "2.0";
  data: CharacterCardData;
}

/**
 * Character Card V3 format (includes root-level compatibility fields)
 */
export interface CharacterCardV3 {
  spec: "chara_card_v3";
  spec_version: "3.0";
  data: CharacterCardData;
  // V3 root-level compatibility fields
  fav?: boolean;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  tags: string[];
  create_date: string;
  avatar: string;
  creatorcomment: string;
  talkativeness: string;
}

/**
 * Union type for all character card versions
 */
export type CharacterCard = CharacterCardV2 | CharacterCardV3;

/**
 * Stored character card with metadata
 */
export interface StoredCharacterCard {
  id: string;
  name: string;
  spec: "chara_card_v2" | "chara_card_v3";
  importedAt: string;
  sourcePath?: string;
  data: CharacterCardData;
}

// ============================================================================
// World Info Types
// ============================================================================

/**
 * Character filter for world info entries
 */
export interface CharacterFilter {
  isExclude: boolean;
  names: string[];
  tags: string[];
}

/**
 * World info entry (lorebook entry)
 */
export interface WorldInfoEntry {
  uid: number;
  key: string[];
  keysecondary: string[];
  comment: string;
  content: string;
  // Activation control
  constant: boolean;
  selective: boolean;
  selectiveLogic: number;
  disable: boolean;
  // Probability
  probability: number;
  useProbability: boolean;
  // Position and order
  order: number;
  position: number;
  depth: number;
  displayIndex: number;
  // Scan settings
  scanDepth: number | null;
  caseSensitive: boolean | null;
  matchWholeWords: boolean | null;
  // Recursion
  excludeRecursion: boolean;
  preventRecursion: boolean;
  delayUntilRecursion: boolean;
  // Grouping
  group: string;
  groupOverride: boolean;
  groupWeight: number;
  useGroupScoring: boolean | null;
  // Match scope
  matchPersonaDescription: boolean;
  matchCharacterDescription: boolean;
  matchCharacterPersonality: boolean;
  matchCharacterDepthPrompt: boolean;
  matchScenario: boolean;
  matchCreatorNotes: boolean;
  // Advanced
  role: number | null;
  vectorized: boolean;
  automationId: string;
  sticky: number;
  cooldown: number;
  delay: number;
  ignoreBudget: boolean;
  // Triggers and filters
  triggers: string[];
  characterFilter: CharacterFilter;
  outletName: string;
  addMemo: boolean;
}

/**
 * World info book structure
 */
export interface WorldInfoBook {
  entries: Record<string, WorldInfoEntry>;
}

/**
 * Stored world info book with metadata
 */
export interface StoredWorldInfoBook {
  id: string;
  name: string;
  importedAt: string;
  sourcePath?: string;
  enabled: boolean;
  entries: Record<string, WorldInfoEntry>;
  entryOverrides?: Record<number, { disabled?: boolean }>;
}

// ============================================================================
// Preset Types
// ============================================================================

/**
 * Preset prompt entry
 */
export interface PresetPromptEntry {
  identifier: string;
  name: string;
  enabled: boolean;
  role: "system" | "user" | "assistant";
  content: string;
  // Injection control
  injection_position: number;
  injection_depth: number;
  injection_order: number;
  // Special markers
  system_prompt: boolean;
  marker: boolean;
  forbid_overrides: boolean;
  // Triggers
  injection_trigger?: string[];
}

/**
 * SillyTavern preset structure
 */
export interface SillyTavernPreset {
  // Sampling parameters
  temperature: number;
  frequency_penalty: number;
  presence_penalty: number;
  top_p: number;
  top_k: number;
  top_a: number;
  min_p: number;
  repetition_penalty: number;
  openai_max_context: number;
  openai_max_tokens: number;
  // Prompt entries (core)
  prompts: PresetPromptEntry[];
  // Format templates
  wi_format: string;
  scenario_format: string;
  personality_format: string;
  // Special prompts
  impersonation_prompt: string;
  new_chat_prompt: string;
  new_group_chat_prompt: string;
  new_example_chat_prompt: string;
  continue_nudge_prompt: string;
  group_nudge_prompt: string;
  // Other settings
  stream_openai: boolean;
  wrap_in_quotes: boolean;
  names_behavior: number;
  send_if_empty: string;
  bias_preset_selected: string;
  max_context_unlocked: boolean;
}

/**
 * Stored preset with metadata
 */
export interface StoredPreset {
  id: string;
  name: string;
  importedAt: string;
  sourcePath?: string;
  data: SillyTavernPreset;
  entryOverrides?: Record<string, { enabled?: boolean }>;
}

// ============================================================================
// Plugin Config Types
// ============================================================================

/**
 * Character card configuration
 */
export interface CharacterConfig {
  active?: string;
  mergeWithSoul?: boolean;
  includeExamples?: boolean;
  includeScenario?: boolean;
  includeFirstMessage?: boolean;
}

/**
 * World info configuration
 */
export interface WorldInfoConfig {
  enabled?: boolean;
  books?: string[];
  scanDepth?: number;
  maxEntries?: number;
  maxTokens?: number;
  recursiveScan?: boolean;
}

/**
 * Preset configuration
 */
export interface PresetConfig {
  active?: string;
  applySystemPrompt?: boolean;
  applySamplingParams?: boolean;
  applyMacros?: boolean;
}

/**
 * Macro variables configuration
 * These variables can be used in presets and character cards with {{variable}} syntax
 */
export interface MacrosConfig {
  /** User's display name (replaces {{user}}) */
  user?: string;
  /** Character's display name override (replaces {{char}}, defaults to character card name) */
  char?: string;
  /** Current date format (replaces {{date}}) */
  dateFormat?: string;
  /** Current time format (replaces {{time}}) */
  timeFormat?: string;
  /** Idle duration in minutes before triggering idle prompts */
  idleDuration?: number;
  /** Random number seed for {{random}} macro */
  randomSeed?: number;
  /** Custom variables that can be used with {{custom::key}} syntax */
  customVariables?: Record<string, string>;
}

/**
 * Memory configuration for the plugin
 */
export interface MemoryConfig {
  /** Whether memory system is enabled */
  enabled?: boolean;
  /** Maximum memories to inject per request */
  maxMemoriesPerRequest?: number;
  /** Maximum tokens for memory injection */
  maxMemoryTokens?: number;
  /** Whether to use keyword-based retrieval */
  useKeywordRetrieval?: boolean;
  /** Minimum importance score for injection (0-100) */
  minImportance?: number;
  /** How to sort memories: importance, recency, or accessCount */
  sortBy?: "importance" | "recency" | "accessCount";
  /** Whether to auto-extract memories from conversations */
  autoExtract?: boolean;
  /** Keywords that trigger memory extraction */
  extractionTriggers?: string[];
}

/**
 * Skills configuration for the plugin
 */
export interface SkillsConfig {
  /** Whether skills system is enabled */
  enabled?: boolean;
  /** Maximum skills to include in prompt */
  maxSkills?: number;
  /** Maximum tokens for skills content */
  maxTokens?: number;
  /** Only include these skills (allowlist) */
  filter?: string[];
  /** Skills to always include regardless of eligibility */
  always?: string[];
  /** Skills to exclude */
  exclude?: string[];
  /** Watch skills directory for changes */
  watch?: boolean;
  /** Extra directories to scan for skills */
  extraDirs?: string[];
}

/**
 * SillyTavern plugin configuration
 */
export interface SillyTavernPluginConfig {
  character?: CharacterConfig;
  worldInfo?: WorldInfoConfig;
  preset?: PresetConfig;
  macros?: MacrosConfig;
  memory?: MemoryConfig;
  skills?: SkillsConfig;
}

// ============================================================================
// Storage Index Types
// ============================================================================

/**
 * Character card index entry
 */
export interface CharacterIndexEntry {
  id: string;
  name: string;
  spec: "chara_card_v2" | "chara_card_v3";
  importedAt: string;
  tags?: string[];
}

/**
 * Character cards index
 */
export interface CharacterIndex {
  version: number;
  entries: CharacterIndexEntry[];
  active?: string;
}

/**
 * World info book index entry
 */
export interface WorldInfoIndexEntry {
  id: string;
  name: string;
  importedAt: string;
  enabled: boolean;
  entryCount: number;
}

/**
 * World info books index
 */
export interface WorldInfoIndex {
  version: number;
  entries: WorldInfoIndexEntry[];
}

/**
 * Preset index entry
 */
export interface PresetIndexEntry {
  id: string;
  name: string;
  importedAt: string;
  promptCount: number;
}

/**
 * Presets index
 */
export interface PresetIndex {
  version: number;
  entries: PresetIndexEntry[];
  active?: string;
}
