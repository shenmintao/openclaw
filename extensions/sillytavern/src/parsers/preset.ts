/**
 * SillyTavern Preset Parser
 * Parses SillyTavern preset files and handles prompt entry management
 */

import type {
  SillyTavernPreset,
  PresetPromptEntry,
  StoredPreset,
} from "../types.js";

/**
 * Parse result type
 */
export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Parse a preset JSON string
 */
export function parsePresetJson(jsonString: string): ParseResult<{ name: string; preset: SillyTavernPreset }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    return {
      success: false,
      error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Validate basic structure
  if (!parsed || typeof parsed !== "object") {
    return { success: false, error: "Preset must be an object" };
  }

  const obj = parsed as Record<string, unknown>;

  // Check for prompts array (required for a valid preset)
  if (!obj.prompts || !Array.isArray(obj.prompts)) {
    return { success: false, error: "Preset must have a 'prompts' array" };
  }

  // Parse prompts
  const prompts: PresetPromptEntry[] = [];
  for (const prompt of obj.prompts) {
    const parsed = parsePromptEntry(prompt);
    if (parsed) {
      prompts.push(parsed);
    }
  }

  // Extract name from preset or use default
  const name = typeof obj.name === "string" ? obj.name : "Unnamed Preset";

  const preset: SillyTavernPreset = {
    // Sampling parameters
    temperature: typeof obj.temperature === "number" ? obj.temperature : 1.0,
    frequency_penalty: typeof obj.frequency_penalty === "number" ? obj.frequency_penalty : 0,
    presence_penalty: typeof obj.presence_penalty === "number" ? obj.presence_penalty : 0,
    top_p: typeof obj.top_p === "number" ? obj.top_p : 1.0,
    top_k: typeof obj.top_k === "number" ? obj.top_k : 0,
    top_a: typeof obj.top_a === "number" ? obj.top_a : 0,
    min_p: typeof obj.min_p === "number" ? obj.min_p : 0,
    repetition_penalty: typeof obj.repetition_penalty === "number" ? obj.repetition_penalty : 1.0,
    openai_max_context: typeof obj.openai_max_context === "number" ? obj.openai_max_context : 4096,
    openai_max_tokens: typeof obj.openai_max_tokens === "number" ? obj.openai_max_tokens : 0,
    // Prompt entries
    prompts,
    // Format templates
    wi_format: typeof obj.wi_format === "string" ? obj.wi_format : "[{{name}}:\n{{content}}]",
    scenario_format: typeof obj.scenario_format === "string" ? obj.scenario_format : "[Scenario: {{scenario}}]",
    personality_format: typeof obj.personality_format === "string" ? obj.personality_format : "[{{char}}'s personality: {{personality}}]",
    // Special prompts
    impersonation_prompt: typeof obj.impersonation_prompt === "string" ? obj.impersonation_prompt : "",
    new_chat_prompt: typeof obj.new_chat_prompt === "string" ? obj.new_chat_prompt : "",
    new_group_chat_prompt: typeof obj.new_group_chat_prompt === "string" ? obj.new_group_chat_prompt : "",
    new_example_chat_prompt: typeof obj.new_example_chat_prompt === "string" ? obj.new_example_chat_prompt : "",
    continue_nudge_prompt: typeof obj.continue_nudge_prompt === "string" ? obj.continue_nudge_prompt : "",
    group_nudge_prompt: typeof obj.group_nudge_prompt === "string" ? obj.group_nudge_prompt : "",
    // Other settings
    stream_openai: obj.stream_openai === true,
    wrap_in_quotes: obj.wrap_in_quotes === true,
    names_behavior: typeof obj.names_behavior === "number" ? obj.names_behavior : 0,
    send_if_empty: typeof obj.send_if_empty === "string" ? obj.send_if_empty : "",
    bias_preset_selected: typeof obj.bias_preset_selected === "string" ? obj.bias_preset_selected : "",
    max_context_unlocked: obj.max_context_unlocked === true,
  };

  return { success: true, data: { name, preset } };
}

/**
 * Parse a single prompt entry
 */
function parsePromptEntry(entry: unknown): PresetPromptEntry | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const obj = entry as Record<string, unknown>;

  // Identifier is required
  const identifier = typeof obj.identifier === "string" ? obj.identifier : "";
  if (!identifier) {
    return null;
  }

  // Parse role
  let role: "system" | "user" | "assistant" = "system";
  if (obj.role === "user") {
    role = "user";
  } else if (obj.role === "assistant") {
    role = "assistant";
  }

  return {
    identifier,
    name: typeof obj.name === "string" ? obj.name : identifier,
    enabled: obj.enabled !== false, // Default to true
    role,
    content: typeof obj.content === "string" ? obj.content : "",
    // Injection control
    injection_position: typeof obj.injection_position === "number" ? obj.injection_position : 0,
    injection_depth: typeof obj.injection_depth === "number" ? obj.injection_depth : 4,
    injection_order: typeof obj.injection_order === "number" ? obj.injection_order : 100,
    // Special markers
    system_prompt: obj.system_prompt === true,
    marker: obj.marker === true,
    forbid_overrides: obj.forbid_overrides === true,
    // Triggers
    injection_trigger: Array.isArray(obj.injection_trigger)
      ? obj.injection_trigger.filter((t): t is string => typeof t === "string")
      : undefined,
  };
}

/**
 * Convert parsed preset to stored format
 */
export function toStoredPreset(
  name: string,
  preset: SillyTavernPreset,
  sourcePath?: string,
): StoredPreset {
  const id = generatePresetId(name);
  return {
    id,
    name,
    importedAt: new Date().toISOString(),
    sourcePath,
    data: preset,
  };
}

/**
 * Generate a unique ID for a preset
 */
function generatePresetId(name: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 20);
  return `preset-${nameSlug}-${timestamp}-${random}`;
}

/**
 * Get enabled prompts from a preset
 */
export function getEnabledPrompts(
  preset: SillyTavernPreset,
  overrides?: Record<string, { enabled?: boolean }>,
): PresetPromptEntry[] {
  return preset.prompts.filter((prompt) => {
    // Check for override
    if (overrides && overrides[prompt.identifier]) {
      const override = overrides[prompt.identifier];
      if (override.enabled !== undefined) {
        return override.enabled;
      }
    }
    return prompt.enabled;
  });
}

/**
 * Build the system prompt from enabled preset prompts
 */
export function buildPresetSystemPrompt(
  enabledPrompts: PresetPromptEntry[],
  options?: {
    separator?: string;
    includeMarkers?: boolean;
  },
): string {
  const separator = options?.separator ?? "\n\n";
  const includeMarkers = options?.includeMarkers ?? false;

  // Filter to system prompts only
  const systemPrompts = enabledPrompts.filter((p) => {
    if (!includeMarkers && p.marker) {
      return false;
    }
    return p.role === "system" && p.content;
  });

  // Sort by injection order
  systemPrompts.sort((a, b) => a.injection_order - b.injection_order);

  return systemPrompts.map((p) => p.content).join(separator);
}

/**
 * Get a summary of a preset
 */
export function getPresetSummary(stored: StoredPreset): {
  name: string;
  promptCount: number;
  enabledCount: number;
  systemPromptCount: number;
  temperature: number;
  maxContext: number;
} {
  const prompts = stored.data.prompts;
  const enabledPrompts = prompts.filter((p) => p.enabled);
  const systemPrompts = enabledPrompts.filter((p) => p.role === "system" && !p.marker);

  return {
    name: stored.name,
    promptCount: prompts.length,
    enabledCount: enabledPrompts.length,
    systemPromptCount: systemPrompts.length,
    temperature: stored.data.temperature,
    maxContext: stored.data.openai_max_context,
  };
}

/**
 * Apply macros to a prompt content
 * Supports both standard {{macro}} and custom {{custom::key}} syntax
 */
export function applyMacros(
  content: string,
  macros: Record<string, string>,
  customVariables?: Record<string, string>,
): string {
  let result = content;

  // Apply standard macros
  for (const [key, value] of Object.entries(macros)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
    result = result.replace(pattern, value);
  }

  // Apply custom variables with {{custom::key}} syntax
  if (customVariables) {
    for (const [key, value] of Object.entries(customVariables)) {
      const pattern = new RegExp(`\\{\\{custom::${key}\\}\\}`, "gi");
      result = result.replace(pattern, value);
    }
  }

  return result;
}

/**
 * Format date according to format string
 * Supports: YYYY, MM, DD, HH, mm, ss
 */
function formatDate(date: Date, format: string): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return format
    .replace(/YYYY/g, date.getFullYear().toString())
    .replace(/MM/g, pad(date.getMonth() + 1))
    .replace(/DD/g, pad(date.getDate()))
    .replace(/HH/g, pad(date.getHours()))
    .replace(/mm/g, pad(date.getMinutes()))
    .replace(/ss/g, pad(date.getSeconds()));
}

/**
 * Macro options interface
 */
export interface MacroOptions {
  /** User's display name */
  user?: string;
  /** Character's display name */
  char?: string;
  /** User persona description */
  persona?: string;
  /** Date format string (default: YYYY-MM-DD) */
  dateFormat?: string;
  /** Time format string (default: HH:mm) */
  timeFormat?: string;
  /** Idle duration in minutes */
  idleDuration?: number;
  /** Random seed for reproducible random values */
  randomSeed?: number;
}

/**
 * Get default macros with configurable options
 */
export function getDefaultMacros(options?: MacroOptions): Record<string, string> {
  const now = new Date();
  const dateFormat = options?.dateFormat ?? "YYYY-MM-DD";
  const timeFormat = options?.timeFormat ?? "HH:mm";

  // Generate random value (optionally seeded)
  let randomValue: number;
  if (options?.randomSeed !== undefined) {
    // Simple seeded random using the seed
    const seed = options.randomSeed;
    randomValue = Math.abs((seed * 9301 + 49297) % 233280) % 100;
  } else {
    randomValue = Math.floor(Math.random() * 100);
  }

  return {
    // Identity macros
    user: options?.user ?? "User",
    char: options?.char ?? "Assistant",
    persona: options?.persona ?? "",
    // Time macros with configurable formats
    time: formatDate(now, timeFormat),
    date: formatDate(now, dateFormat),
    weekday: now.toLocaleDateString("en-US", { weekday: "long" }),
    month: now.toLocaleDateString("en-US", { month: "long" }),
    year: now.getFullYear().toString(),
    // Other common macros
    idle_duration: String(options?.idleDuration ?? 0),
    random: String(randomValue),
    // Additional useful macros
    newline: "\n",
    tab: "\t",
  };
}
