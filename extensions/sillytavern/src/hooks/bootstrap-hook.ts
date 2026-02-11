/**
 * Bootstrap Hook for SillyTavern
 * Injects character card, world info, preset content, memories, and skills into the system prompt
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type {
  CharacterConfig,
  WorldInfoConfig,
  PresetConfig,
  SillyTavernPluginConfig,
  MemoryConfig,
  SkillsConfig,
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
import {
  getOrCreateMemoryBook,
  retrieveMemories,
  buildMemoryPrompt,
  autoExtractMemories,
} from "../memory/store.js";
import {
  getEligibleSkills,
  buildSkillSnapshot,
} from "../skills/store.js";
import { buildSkillsPrompt } from "../skills/parser.js";

/**
 * Message type from the agent context
 */
interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; text?: string }>;
}

/**
 * Extract text content from messages for World Info keyword matching.
 * Respects scanDepth config to limit how many recent messages to scan.
 */
function extractContextFromMessages(
  messages: unknown[] | undefined,
  scanDepth: number,
): string {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return "";
  }

  // Get the most recent messages based on scanDepth
  const recentMessages = messages.slice(-scanDepth);

  const textParts: string[] = [];

  for (const msg of recentMessages) {
    if (!msg || typeof msg !== "object") continue;

    const message = msg as AgentMessage;

    // Skip system messages for keyword matching
    if (message.role === "system") continue;

    // Extract text content
    if (typeof message.content === "string") {
      textParts.push(message.content);
    } else if (Array.isArray(message.content)) {
      // Handle multi-part content (e.g., with images)
      for (const part of message.content) {
        if (part && typeof part === "object" && part.type === "text" && typeof part.text === "string") {
          textParts.push(part.text);
        }
      }
    }
  }

  return textParts.join("\n");
}

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
 * Get memory config with defaults
 */
function getMemoryConfig(pluginConfig?: SillyTavernPluginConfig): MemoryConfig {
  return {
    enabled: true,
    maxMemoriesPerRequest: 10,
    maxMemoryTokens: 1000,
    useKeywordRetrieval: true,
    minImportance: 50,
    sortBy: "importance",
    autoExtract: false,
    extractionTriggers: ["remember", "important", "don't forget", "note that"],
    ...pluginConfig?.memory,
  };
}

/**
 * Get skills config with defaults
 */
function getSkillsConfig(pluginConfig?: SillyTavernPluginConfig): SkillsConfig {
  return {
    enabled: true,
    maxSkills: 20,
    maxTokens: 4096,
    filter: undefined,
    always: [],
    exclude: [],
    watch: false,
    extraDirs: [],
    ...pluginConfig?.skills,
  };
}

/**
 * Register the bootstrap hook using before_agent_start
 * This hook injects character card, world info, preset content, and skills as prependContext
 */
export function registerBootstrapHook(api: OpenClawPluginApi): void {
  // Use before_agent_start hook to inject content
  api.on("before_agent_start", async (event, ctx) => {
    const pluginConfig = getPluginConfig(api.config as unknown as Record<string, unknown>);
    const characterConfig = getCharacterConfig(pluginConfig);
    const worldInfoConfig = getWorldInfoConfig(pluginConfig);
    const presetConfig = getPresetConfig(pluginConfig);
    const memoryConfig = getMemoryConfig(pluginConfig);
    const skillsConfig = getSkillsConfig(pluginConfig);

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
              char: pluginConfig?.macros?.char ?? activeCard?.name,
              dateFormat: pluginConfig?.macros?.dateFormat,
              timeFormat: pluginConfig?.macros?.timeFormat,
              idleDuration: pluginConfig?.macros?.idleDuration,
              randomSeed: pluginConfig?.macros?.randomSeed,
            });

            presetPrompt = applyMacros(presetPrompt, macros, pluginConfig?.macros?.customVariables);
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
        // This enables dynamic World Info activation based on conversation history
        const conversationContext = extractContextFromMessages(
          event.messages,
          worldInfoConfig.scanDepth ?? 5,
        );

        // Also include the current prompt in the context for keyword matching
        const fullContext = conversationContext
          ? `${conversationContext}\n${event.prompt}`
          : event.prompt;

        api.logger.debug?.(
          `[sillytavern] World Info context built (${fullContext.length} chars from ${
            event.messages?.length ?? 0
          } messages)`,
        );

        const allActivatedEntries: ReturnType<typeof getActivatedEntries> = [];

        for (const book of enabledBooks) {
          // Get activated entries based on keyword matching against conversation context
          const activated = getActivatedEntries(book, fullContext, worldInfoConfig);
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
    // Memory Injection
    // ========================================================================

    if (memoryConfig.enabled !== false) {
      try {
        // Get or create memory book for this character/session
        // sessionKey comes from ctx (PluginHookAgentContext), not event
        const memoryBook = getOrCreateMemoryBook({
          characterId: activeCard?.id,
          characterName: activeCard?.name,
          sessionKey: ctx?.sessionKey,
        });

        if (memoryBook && memoryBook.entries.length > 0) {
          api.logger.debug?.(
            `[sillytavern] Processing memory book: ${memoryBook.name} (${memoryBook.entries.length} entries)`,
          );

          // Build context for keyword-based retrieval
          const conversationContext = extractContextFromMessages(
            event.messages,
            worldInfoConfig.scanDepth ?? 5,
          );
          const fullContext = conversationContext
            ? `${conversationContext}\n${event.prompt}`
            : event.prompt;

          // Retrieve relevant memories
          const retrievalResult = retrieveMemories(memoryBook.id, fullContext, {
            maxMemories: memoryConfig.maxMemoriesPerRequest ?? 10,
            minImportance: memoryConfig.minImportance ?? 50,
            sortBy: memoryConfig.sortBy ?? "importance",
          });

          if (retrievalResult.memories.length > 0) {
            const memoryPrompt = buildMemoryPrompt(retrievalResult.memories);

            if (memoryPrompt) {
              contextParts.push(memoryPrompt);
              api.logger.debug?.(
                `[sillytavern] Memory prompt built (${retrievalResult.memories.length} memories, ${memoryPrompt.length} chars)`,
              );
            }
          }
        }
      } catch (error) {
        api.logger.warn?.(`[sillytavern] Failed to inject memories: ${error}`);
      }
    }

    // ========================================================================
    // Skills Injection
    // ========================================================================

    if (skillsConfig.enabled !== false) {
      try {
        // Get eligible skills based on config
        const eligibleSkills = await getEligibleSkills(skillsConfig);

        if (eligibleSkills.length > 0) {
          api.logger.debug?.(
            `[sillytavern] Processing ${eligibleSkills.length} eligible skills`,
          );

          // Build skills prompt
          const skillsPrompt = buildSkillsPrompt(eligibleSkills, {
            maxTokens: skillsConfig.maxTokens ?? 4096,
          });

          if (skillsPrompt) {
            contextParts.push(skillsPrompt);
            api.logger.debug?.(
              `[sillytavern] Skills prompt built (${eligibleSkills.length} skills, ${skillsPrompt.length} chars)`,
            );
          }
        }
      } catch (error) {
        api.logger.warn?.(`[sillytavern] Failed to inject skills: ${error}`);
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

  // ============================================================================
  // Agent End Hook - Auto-extract memories from conversation
  // ============================================================================

  api.on("agent_end", async (event, ctx) => {
    const pluginConfig = getPluginConfig(api.config as unknown as Record<string, unknown>);
    const memoryConfig = getMemoryConfig(pluginConfig);

    // Only extract if auto-extract is enabled
    if (!memoryConfig.autoExtract) {
      return;
    }

    try {
      // Get active character card
      const activeCard = await getActiveCharacterCard();

      // Get or create memory book
      const memoryBook = getOrCreateMemoryBook({
        characterId: activeCard?.id,
        characterName: activeCard?.name,
        sessionKey: ctx?.sessionKey,
      });

      if (!memoryBook) {
        return;
      }

      // Extract memories from conversation
      const messages = event.messages as Array<{ role: string; content: string | unknown }>;
      const triggers = memoryConfig.extractionTriggers ?? [
        "remember",
        "important",
        "don't forget",
        "note that",
        "记住",
        "重要",
        "别忘了",
      ];

      const extractedMemories = autoExtractMemories(memoryBook.id, messages, triggers);

      if (extractedMemories.length > 0) {
        api.logger.debug?.(
          `[sillytavern] Auto-extracted ${extractedMemories.length} memories from conversation`,
        );
      }
    } catch (error) {
      api.logger.warn?.(`[sillytavern] Failed to auto-extract memories: ${error}`);
    }
  });
}
