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
      },
    },
  };
}
