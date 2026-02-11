/**
 * Bootstrap Hook for SillyTavern
 * Injects character card, world info, and preset content into the system prompt
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type {
  CharacterConfig,
  WorldInfoConfig,
  PresetConfig,
  SillyTavernPluginConfig,
} from "../types.js";
import { buildCharacterPrompt } from "../parsers/character-card.js";
import { getActiveCharacterCard } from "../storage/character-store.js";
import { getEnabledWorldInfoBooks } from "../storage/world-info-store.js";
import { getActivatedEntries, buildWorldInfoPrompt } from "../parsers/world-info.js";
import { getActivePreset } from "../storage/preset-store.js";
import {
  getEnabledPrompts,
  buildPresetSystemPrompt,
  applyMacros,
  getDefaultMacros,
} from "../parsers/preset.js";

/**
 * Get plugin config from OpenClaw config
 */
function getPluginConfig(config: Record<string, unknown>): SillyTavernPluginConfig | undefined {
  const plugins = config.plugins as Record<string, unknown> | undefined;
  return plugins?.sillytavern as SillyTavernPluginConfig | undefined;
}

/**
 * Get character config with defaults
 */
function getCharacterConfig(pluginConfig?: SillyTavernPluginConfig): CharacterConfig {
  return {
    mergeWithSoul: true,
    includeExamples: true,
    includeScenario: true,
    includeFirstMessage: false,
    ...pluginConfig?.character,
  };
}

/**
 * Get world info config with defaults
 */
function getWorldInfoConfig(pluginConfig?: SillyTavernPluginConfig): WorldInfoConfig {
  return {
    enabled: true,
    scanDepth: 5,
    maxEntries: 10,
    maxTokens: 2048,
    recursiveScan: false,
    ...pluginConfig?.worldInfo,
  };
}

/**
 * Get preset config with defaults
 */
function getPresetConfig(pluginConfig?: SillyTavernPluginConfig): PresetConfig {
  return {
    applySystemPrompt: true,
    applyMacros: true,
    applySamplingParams: false,
    ...pluginConfig?.preset,
  };
}

/**
 * Register the bootstrap hook using before_agent_start
 * This hook injects character card, world info, and preset content as prependContext
 */
export function registerBootstrapHook(api: OpenClawPluginApi): void {
  // Use before_agent_start hook to inject content
  api.on("before_agent_start", async (event) => {
    const pluginConfig = getPluginConfig(api.config as unknown as Record<string, unknown>);
    const characterConfig = getCharacterConfig(pluginConfig);
    const worldInfoConfig = getWorldInfoConfig(pluginConfig);
    const presetConfig = getPresetConfig(pluginConfig);

    const contextParts: string[] = [];

    // Get active character card for macro substitution
    const activeCard = await getActiveCharacterCard();

    // ========================================================================
    // Preset Injection (System Prompts)
    // ========================================================================

    if (presetConfig.applySystemPrompt !== false) {
      const activePreset = await getActivePreset();

      if (activePreset) {
        api.logger.debug?.(`[sillytavern] Injecting preset: ${activePreset.name}`);

        // Get enabled prompts with any overrides
        const enabledPrompts = getEnabledPrompts(activePreset.data, activePreset.entryOverrides);

        if (enabledPrompts.length > 0) {
          // Build the system prompt from enabled prompts
          let presetPrompt = buildPresetSystemPrompt(enabledPrompts, {
            separator: "\n\n",
            includeMarkers: false,
          });

          // Apply macros if enabled
          if (presetConfig.applyMacros !== false && presetPrompt) {
            const macros = getDefaultMacros({
              user: pluginConfig?.macros?.user,
              char: activeCard?.name,
            });

            // Add custom variables if defined
            if (pluginConfig?.macros?.customVariables) {
              Object.assign(macros, pluginConfig.macros.customVariables);
            }

            presetPrompt = applyMacros(presetPrompt, macros);
          }

          if (presetPrompt) {
            contextParts.push(presetPrompt);
            api.logger.debug?.(
              `[sillytavern] Preset prompt built (${enabledPrompts.length} prompts, ${presetPrompt.length} chars)`,
            );
          }
        }
      }
    }

    // ========================================================================
    // Character Card Injection
    // ========================================================================

    if (activeCard) {
      api.logger.debug?.(`[sillytavern] Injecting character card: ${activeCard.name}`);

      const characterPrompt = buildCharacterPrompt(activeCard.data, {
        includeSystemPrompt: true,
        includeDescription: true,
        includePersonality: true,
        includeScenario: characterConfig.includeScenario,
        includeExamples: characterConfig.includeExamples,
        includePostHistory: false,
      });

      if (characterPrompt) {
        contextParts.push(characterPrompt);
        api.logger.debug?.(
          `[sillytavern] Character card prompt built (${characterPrompt.length} chars)`,
        );
      }
    }

    // ========================================================================
    // World Info Injection
    // ========================================================================

    if (worldInfoConfig.enabled !== false) {
      const enabledBooks = await getEnabledWorldInfoBooks();

      if (enabledBooks.length > 0) {
        api.logger.debug?.(`[sillytavern] Processing ${enabledBooks.length} world info books`);

        // Build context from recent messages for keyword matching
        // For now, we'll use constant entries only (always activated)
        // Full keyword matching requires access to conversation history
        const allActivatedEntries: ReturnType<typeof getActivatedEntries> = [];

        for (const book of enabledBooks) {
          // Get constant entries (always activated)
          const activated = getActivatedEntries(book, "", worldInfoConfig);
          allActivatedEntries.push(...activated);
        }

        if (allActivatedEntries.length > 0) {
          // Sort by order and apply maxEntries limit
          allActivatedEntries.sort((a, b) => (a.entry.order ?? 100) - (b.entry.order ?? 100));
          const limitedEntries = worldInfoConfig.maxEntries
            ? allActivatedEntries.slice(0, worldInfoConfig.maxEntries)
            : allActivatedEntries;

          const worldInfoPrompt = buildWorldInfoPrompt(limitedEntries, {
            maxTokens: worldInfoConfig.maxTokens,
          });

          if (worldInfoPrompt) {
            contextParts.push(worldInfoPrompt);
            api.logger.debug?.(
              `[sillytavern] World info prompt built (${limitedEntries.length} entries, ${worldInfoPrompt.length} chars)`,
            );
          }
        }
      }
    }

    // ========================================================================
    // Return Combined Context
    // ========================================================================

    if (contextParts.length === 0) {
      return undefined;
    }

    const combinedContext = contextParts.join("\n\n---\n\n");
    return {
      prependContext: combinedContext,
    };
  });

  // Also register for agent:bootstrap internal hook to modify bootstrap files
  api.registerHook("agent:bootstrap", async (event) => {
    const context = event.context as {
      workspaceDir?: string;
      bootstrapFiles?: Array<{
        name: string;
        path: string;
        content?: string;
        missing: boolean;
      }>;
      cfg?: unknown;
    };

    if (!context.bootstrapFiles) {
      return;
    }

    const pluginConfig = getPluginConfig(
      (context.cfg ?? api.config) as unknown as Record<string, unknown>,
    );
    const characterConfig = getCharacterConfig(pluginConfig);

    // Get the active character card
    const activeCard = await getActiveCharacterCard();
    if (!activeCard) {
      return;
    }

    // Build the character prompt
    const characterPrompt = buildCharacterPrompt(activeCard.data, {
      includeSystemPrompt: true,
      includeDescription: true,
      includePersonality: true,
      includeScenario: characterConfig.includeScenario,
      includeExamples: characterConfig.includeExamples,
      includePostHistory: false,
    });

    if (!characterPrompt) {
      return;
    }

    // Check if we should merge with SOUL.md or replace it
    if (characterConfig.mergeWithSoul) {
      // Find SOUL.md in bootstrap files
      const soulFile = context.bootstrapFiles.find(
        (f) => f.name === "SOUL.md" || f.path.endsWith("SOUL.md"),
      );

      if (soulFile && soulFile.content) {
        // Prepend character prompt to SOUL.md content
        soulFile.content = `${characterPrompt}\n\n---\n\n${soulFile.content}`;
        api.logger.debug?.(
          `[sillytavern] Merged character card with SOUL.md (${soulFile.content.length} chars)`,
        );
      } else {
        // Add as a new bootstrap file
        context.bootstrapFiles.push({
          name: "CHARACTER.md",
          path: "CHARACTER.md",
          content: characterPrompt,
          missing: false,
        });
        api.logger.debug?.("[sillytavern] Added CHARACTER.md bootstrap file");
      }
    } else {
      // Replace SOUL.md with character prompt
      const soulFileIndex = context.bootstrapFiles.findIndex(
        (f) => f.name === "SOUL.md" || f.path.endsWith("SOUL.md"),
      );

      if (soulFileIndex >= 0) {
        context.bootstrapFiles[soulFileIndex].content = characterPrompt;
        api.logger.debug?.("[sillytavern] Replaced SOUL.md with character card");
      } else {
        context.bootstrapFiles.push({
          name: "SOUL.md",
          path: "SOUL.md",
          content: characterPrompt,
          missing: false,
        });
        api.logger.debug?.("[sillytavern] Added SOUL.md with character card");
      }
    }
  });
}
