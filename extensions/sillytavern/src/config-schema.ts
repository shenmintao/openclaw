/**
 * SillyTavern Plugin Config Schema
 * Defines the configuration options for the plugin
 */

import type { SillyTavernPluginConfig } from "./types.js";

type Issue = { path: Array<string | number>; message: string };

type SafeParseResult =
  | { success: true; data: SillyTavernPluginConfig }
  | { success: false; error: { issues: Issue[] } };

/**
 * Plugin config schema interface (matches OpenClawPluginConfigSchema)
 */
export interface PluginConfigSchema {
  safeParse: (value: unknown) => SafeParseResult;
  jsonSchema: Record<string, unknown>;
}

function error(path: Array<string | number>, message: string): SafeParseResult {
  return { success: false, error: { issues: [{ path, message }] } };
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function sillyTavernConfigSchema(): PluginConfigSchema {
  return {
    safeParse(value: unknown): SafeParseResult {
      if (value === undefined) {
        return { success: true, data: {} };
      }
      if (!isRecord(value)) {
        return error([], "expected config object");
      }

      const config: SillyTavernPluginConfig = {};

      // Parse character config
      if (value.character !== undefined) {
        if (!isRecord(value.character)) {
          return error(["character"], "expected object");
        }
        config.character = {};
        const char = value.character;

        if (char.mergeWithSoul !== undefined) {
          if (!isBoolean(char.mergeWithSoul)) {
            return error(["character", "mergeWithSoul"], "expected boolean");
          }
          config.character.mergeWithSoul = char.mergeWithSoul;
        }
        if (char.includeExamples !== undefined) {
          if (!isBoolean(char.includeExamples)) {
            return error(["character", "includeExamples"], "expected boolean");
          }
          config.character.includeExamples = char.includeExamples;
        }
        if (char.includeScenario !== undefined) {
          if (!isBoolean(char.includeScenario)) {
            return error(["character", "includeScenario"], "expected boolean");
          }
          config.character.includeScenario = char.includeScenario;
        }
        if (char.includeFirstMessage !== undefined) {
          if (!isBoolean(char.includeFirstMessage)) {
            return error(["character", "includeFirstMessage"], "expected boolean");
          }
          config.character.includeFirstMessage = char.includeFirstMessage;
        }
      }

      // Parse worldInfo config
      if (value.worldInfo !== undefined) {
        if (!isRecord(value.worldInfo)) {
          return error(["worldInfo"], "expected object");
        }
        config.worldInfo = {};
        const wi = value.worldInfo;

        if (wi.enabled !== undefined) {
          if (!isBoolean(wi.enabled)) {
            return error(["worldInfo", "enabled"], "expected boolean");
          }
          config.worldInfo.enabled = wi.enabled;
        }
        if (wi.scanDepth !== undefined) {
          if (!isNumber(wi.scanDepth)) {
            return error(["worldInfo", "scanDepth"], "expected number");
          }
          config.worldInfo.scanDepth = wi.scanDepth;
        }
        if (wi.maxEntries !== undefined) {
          if (!isNumber(wi.maxEntries)) {
            return error(["worldInfo", "maxEntries"], "expected number");
          }
          config.worldInfo.maxEntries = wi.maxEntries;
        }
        if (wi.maxTokens !== undefined) {
          if (!isNumber(wi.maxTokens)) {
            return error(["worldInfo", "maxTokens"], "expected number");
          }
          config.worldInfo.maxTokens = wi.maxTokens;
        }
        if (wi.recursiveScan !== undefined) {
          if (!isBoolean(wi.recursiveScan)) {
            return error(["worldInfo", "recursiveScan"], "expected boolean");
          }
          config.worldInfo.recursiveScan = wi.recursiveScan;
        }
      }

      // Parse preset config
      if (value.preset !== undefined) {
        if (!isRecord(value.preset)) {
          return error(["preset"], "expected object");
        }
        config.preset = {};
        const preset = value.preset;

        if (preset.applySystemPrompt !== undefined) {
          if (!isBoolean(preset.applySystemPrompt)) {
            return error(["preset", "applySystemPrompt"], "expected boolean");
          }
          config.preset.applySystemPrompt = preset.applySystemPrompt;
        }
        if (preset.applyMacros !== undefined) {
          if (!isBoolean(preset.applyMacros)) {
            return error(["preset", "applyMacros"], "expected boolean");
          }
          config.preset.applyMacros = preset.applyMacros;
        }
        if (preset.applySamplingParams !== undefined) {
          if (!isBoolean(preset.applySamplingParams)) {
            return error(["preset", "applySamplingParams"], "expected boolean");
          }
          config.preset.applySamplingParams = preset.applySamplingParams;
        }
      }

      // Parse macros config
      if (value.macros !== undefined) {
        if (!isRecord(value.macros)) {
          return error(["macros"], "expected object");
        }
        config.macros = {};
        const macros = value.macros;

        if (macros.user !== undefined) {
          if (!isString(macros.user)) {
            return error(["macros", "user"], "expected string");
          }
          config.macros.user = macros.user;
        }
        if (macros.char !== undefined) {
          if (!isString(macros.char)) {
            return error(["macros", "char"], "expected string");
          }
          config.macros.char = macros.char;
        }
        if (macros.dateFormat !== undefined) {
          if (!isString(macros.dateFormat)) {
            return error(["macros", "dateFormat"], "expected string");
          }
          config.macros.dateFormat = macros.dateFormat;
        }
        if (macros.timeFormat !== undefined) {
          if (!isString(macros.timeFormat)) {
            return error(["macros", "timeFormat"], "expected string");
          }
          config.macros.timeFormat = macros.timeFormat;
        }
        if (macros.idleDuration !== undefined) {
          if (!isNumber(macros.idleDuration)) {
            return error(["macros", "idleDuration"], "expected number");
          }
          config.macros.idleDuration = macros.idleDuration;
        }
        if (macros.randomSeed !== undefined) {
          if (!isNumber(macros.randomSeed)) {
            return error(["macros", "randomSeed"], "expected number");
          }
          config.macros.randomSeed = macros.randomSeed;
        }
        if (macros.customVariables !== undefined) {
          if (!isRecord(macros.customVariables)) {
            return error(["macros", "customVariables"], "expected object");
          }
          // Validate all values are strings
          for (const [key, val] of Object.entries(macros.customVariables)) {
            if (!isString(val)) {
              return error(["macros", "customVariables", key], "expected string value");
            }
          }
          config.macros.customVariables = macros.customVariables as Record<string, string>;
        }
      }

      // Parse skills config
      if (value.skills !== undefined) {
        if (!isRecord(value.skills)) {
          return error(["skills"], "expected object");
        }
        config.skills = {};
        const skills = value.skills;

        if (skills.enabled !== undefined) {
          if (!isBoolean(skills.enabled)) {
            return error(["skills", "enabled"], "expected boolean");
          }
          config.skills.enabled = skills.enabled;
        }
        if (skills.maxSkills !== undefined) {
          if (!isNumber(skills.maxSkills)) {
            return error(["skills", "maxSkills"], "expected number");
          }
          config.skills.maxSkills = skills.maxSkills;
        }
        if (skills.maxTokens !== undefined) {
          if (!isNumber(skills.maxTokens)) {
            return error(["skills", "maxTokens"], "expected number");
          }
          config.skills.maxTokens = skills.maxTokens;
        }
        if (skills.filter !== undefined) {
          if (!isStringArray(skills.filter)) {
            return error(["skills", "filter"], "expected string array");
          }
          config.skills.filter = skills.filter;
        }
        if (skills.always !== undefined) {
          if (!isStringArray(skills.always)) {
            return error(["skills", "always"], "expected string array");
          }
          config.skills.always = skills.always;
        }
        if (skills.exclude !== undefined) {
          if (!isStringArray(skills.exclude)) {
            return error(["skills", "exclude"], "expected string array");
          }
          config.skills.exclude = skills.exclude;
        }
        if (skills.watch !== undefined) {
          if (!isBoolean(skills.watch)) {
            return error(["skills", "watch"], "expected boolean");
          }
          config.skills.watch = skills.watch;
        }
        if (skills.extraDirs !== undefined) {
          if (!isStringArray(skills.extraDirs)) {
            return error(["skills", "extraDirs"], "expected string array");
          }
          config.skills.extraDirs = skills.extraDirs;
        }
      }

      return { success: true, data: config };
    },
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        character: {
          type: "object",
          additionalProperties: false,
          properties: {
            mergeWithSoul: {
              type: "boolean",
              description: "Merge character card with SOUL.md (default: true)",
            },
            includeExamples: {
              type: "boolean",
              description: "Include example messages in prompt (default: true)",
            },
            includeScenario: {
              type: "boolean",
              description: "Include scenario in prompt (default: true)",
            },
            includeFirstMessage: {
              type: "boolean",
              description: "Include first message in prompt (default: false)",
            },
          },
        },
        worldInfo: {
          type: "object",
          additionalProperties: false,
          properties: {
            enabled: {
              type: "boolean",
              description: "Enable world info injection (default: true)",
            },
            scanDepth: {
              type: "number",
              description: "Number of recent messages to scan for keywords (default: 5)",
            },
            maxEntries: {
              type: "number",
              description: "Maximum world info entries to inject (default: 10)",
            },
            maxTokens: {
              type: "number",
              description: "Maximum tokens for world info content (default: 2048)",
            },
            recursiveScan: {
              type: "boolean",
              description: "Enable recursive keyword scanning (default: false)",
            },
          },
        },
        preset: {
          type: "object",
          additionalProperties: false,
          properties: {
            applySystemPrompt: {
              type: "boolean",
              description: "Apply preset system prompts (default: true)",
            },
            applyMacros: {
              type: "boolean",
              description: "Apply macro substitution to prompts (default: true)",
            },
            applySamplingParams: {
              type: "boolean",
              description: "Apply preset sampling parameters (default: false)",
            },
          },
        },
        macros: {
          type: "object",
          additionalProperties: false,
          description: "Macro variables for template substitution (e.g., {{user}}, {{char}})",
          properties: {
            user: {
              type: "string",
              description: "User's display name (replaces {{user}})",
            },
            char: {
              type: "string",
              description: "Character's display name override (replaces {{char}}, defaults to character card name)",
            },
            dateFormat: {
              type: "string",
              description: "Date format string for {{date}} macro (default: YYYY-MM-DD)",
            },
            timeFormat: {
              type: "string",
              description: "Time format string for {{time}} macro (default: HH:mm)",
            },
            idleDuration: {
              type: "number",
              description: "Idle duration in minutes before triggering idle prompts",
            },
            randomSeed: {
              type: "number",
              description: "Random number seed for {{random}} macro",
            },
            customVariables: {
              type: "object",
              additionalProperties: { type: "string" },
              description: "Custom variables that can be used with {{custom::key}} syntax",
            },
          },
        },
        memory: {
          type: "object",
          additionalProperties: false,
          properties: {
            enabled: {
              type: "boolean",
              description: "Enable memory system (default: true)",
            },
            maxMemoriesPerRequest: {
              type: "number",
              description: "Maximum memories to inject per request (default: 10)",
            },
            maxMemoryTokens: {
              type: "number",
              description: "Maximum tokens for memory content (default: 1000)",
            },
            useKeywordRetrieval: {
              type: "boolean",
              description: "Use keyword-based memory retrieval (default: true)",
            },
            minImportance: {
              type: "number",
              description: "Minimum importance score for injection (0-100, default: 50)",
            },
            sortBy: {
              type: "string",
              enum: ["importance", "recency", "accessCount"],
              description: "How to sort memories for injection (default: importance)",
            },
            autoExtract: {
              type: "boolean",
              description: "Auto-extract memories from conversations (deprecated, use extractMode)",
            },
            extractionTriggers: {
              type: "array",
              items: { type: "string" },
              description: "Keywords that trigger memory extraction",
            },
            extractMode: {
              type: "string",
              enum: ["off", "trigger", "auto"],
              description: "Memory extraction mode: off (disabled), trigger (keyword-based), auto (every turn)",
            },
            vectorSearch: {
              type: "object",
              additionalProperties: false,
              properties: {
                enabled: {
                  type: "boolean",
                  description: "Enable vector-based semantic search (default: false)",
                },
                embeddingProvider: {
                  type: "string",
                  enum: ["openai", "voyage", "gemini", "local"],
                  description: "Embedding provider to use (default: openai)",
                },
                embeddingModel: {
                  type: "string",
                  description: "Embedding model name",
                },
                minScore: {
                  type: "number",
                  description: "Minimum similarity score for vector search (0-1, default: 0.3)",
                },
                useHybrid: {
                  type: "boolean",
                  description: "Use hybrid search combining vector and keyword (default: true)",
                },
                vectorWeight: {
                  type: "number",
                  description: "Vector weight in hybrid search (0-1, default: 0.7)",
                },
                keywordWeight: {
                  type: "number",
                  description: "Keyword weight in hybrid search (0-1, default: 0.3)",
                },
              },
            },
            deduplicationThreshold: {
              type: "number",
              description: "Similarity threshold for memory deduplication (0-1, default: 0.85)",
            },
          },
        },
        skills: {
          type: "object",
          additionalProperties: false,
          properties: {
            enabled: {
              type: "boolean",
              description: "Enable skills injection (default: true)",
            },
            maxSkills: {
              type: "number",
              description: "Maximum skills to include in prompt (default: 20)",
            },
            maxTokens: {
              type: "number",
              description: "Maximum tokens for skills content (default: 4096)",
            },
            filter: {
              type: "array",
              items: { type: "string" },
              description: "Only include these skills (allowlist)",
            },
            always: {
              type: "array",
              items: { type: "string" },
              description: "Skills to always include regardless of eligibility",
            },
            exclude: {
              type: "array",
              items: { type: "string" },
              description: "Skills to exclude",
            },
            watch: {
              type: "boolean",
              description: "Watch skills directory for changes (default: false)",
            },
            extraDirs: {
              type: "array",
              items: { type: "string" },
              description: "Extra directories to scan for skills",
            },
          },
        },
      },
    },
  };
}
