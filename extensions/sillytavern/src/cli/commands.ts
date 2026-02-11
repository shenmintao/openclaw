/**
 * SillyTavern CLI Commands
 * Provides commands for managing character cards, world info, presets, and memories
 */

import type { Command } from "commander";
import path from "node:path";
import {
  importCharacterCard,
  listCharacterCards,
  getCharacterCardByName,
  deleteCharacterCardByName,
  setActiveCharacterCardByName,
  deactivateCharacterCard,
  getStorageStats as getCharacterStorageStats,
  getActiveCharacterName,
} from "../storage/character-store.js";
import { getCharacterSummary } from "../parsers/character-card.js";
import {
  importWorldInfo,
  listWorldInfoBooks,
  getWorldInfoBookByName,
  deleteWorldInfoBookByName,
  enableWorldInfoBook,
  disableWorldInfoBook,
  getStorageStats as getWorldInfoStorageStats,
} from "../storage/world-info-store.js";
import { getWorldInfoSummary } from "../parsers/world-info.js";
import {
  importPreset,
  listPresets,
  getPresetByName,
  deletePresetByName,
  setActivePresetByName,
  deactivatePreset,
  getActivePresetName,
  togglePresetPrompt,
  getStorageStats as getPresetStorageStats,
} from "../storage/preset-store.js";
import { getPresetSummary } from "../parsers/preset.js";
import {
  loadAllMemoryBooks,
  loadMemoryBook,
  createMemoryBook,
  deleteMemoryBook,
  addMemory,
  updateMemory,
  deleteMemory,
} from "../memory/store.js";
import {
  importSkill,
  loadSkillsIndex,
  loadStoredSkill,
  setSkillEnabled,
  removeSkill,
  getAllSkills,
  loadEnabledSkills,
  syncSkillsFromWorkspace,
} from "../skills/store.js";

/**
 * Register SillyTavern CLI commands
 */
export function registerSillyTavernCli(program: Command): void {
  const sillytavern = program
    .command("sillytavern")
    .alias("st")
    .description("SillyTavern character cards, world info, and presets");

  // ============================================================================
  // Character Card Commands
  // ============================================================================

  const character = sillytavern
    .command("character")
    .alias("char")
    .description("Manage character cards");

  // Import character card
  character
    .command("import <file>")
    .description("Import a character card from a JSON file")
    .action(async (file: string) => {
      const filePath = path.resolve(file);
      console.log(`Importing character card from: ${filePath}`);

      const result = await importCharacterCard(filePath);
      if (!result.success) {
        console.error(`❌ Failed to import: ${result.error}`);
        process.exitCode = 1;
        return;
      }

      const card = result.data!;
      console.log(`✅ Imported character card: ${card.name}`);
      console.log(`   ID: ${card.id}`);
      console.log(`   Spec: ${card.spec}`);
      if (card.data.tags.length > 0) {
        console.log(`   Tags: ${card.data.tags.join(", ")}`);
      }
      if (card.data.creator) {
        console.log(`   Creator: ${card.data.creator}`);
      }
    });

  // List character cards
  character
    .command("list")
    .alias("ls")
    .description("List all imported character cards")
    .option("--json", "Output as JSON")
    .action(async (options: { json?: boolean }) => {
      const cards = await listCharacterCards();
      const activeName = await getActiveCharacterName();

      if (options.json) {
        console.log(JSON.stringify({ cards, active: activeName }, null, 2));
        return;
      }

      if (cards.length === 0) {
        console.log("No character cards imported yet.");
        console.log("Use 'openclaw sillytavern character import <file>' to import one.");
        return;
      }

      console.log(`Character Cards (${cards.length}):\n`);
      for (const card of cards) {
        const isActive = card.name === activeName;
        const activeMarker = isActive ? " ✓ (active)" : "";
        console.log(`  ${card.name}${activeMarker}`);
        console.log(`    ID: ${card.id}`);
        console.log(`    Spec: ${card.spec}`);
        if (card.tags && card.tags.length > 0) {
          console.log(`    Tags: ${card.tags.join(", ")}`);
        }
        console.log();
      }
    });

  // Show character card details
  character
    .command("show <name>")
    .description("Show details of a character card")
    .option("--json", "Output as JSON")
    .action(async (name: string, options: { json?: boolean }) => {
      const card = await getCharacterCardByName(name);
      if (!card) {
        console.error(`❌ Character card not found: ${name}`);
        process.exitCode = 1;
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(card, null, 2));
        return;
      }

      const summary = getCharacterSummary(card);
      console.log(`Character: ${summary.name}`);
      console.log(`Spec: ${summary.spec}`);
      if (summary.creator) {
        console.log(`Creator: ${summary.creator}`);
      }
      if (summary.tags.length > 0) {
        console.log(`Tags: ${summary.tags.join(", ")}`);
      }
      console.log(`Has System Prompt: ${summary.hasSystemPrompt ? "Yes" : "No"}`);
      console.log(`Has World Book: ${summary.hasWorldBook ? "Yes" : "No"}`);
      console.log();
      console.log("Description:");
      console.log(card.data.description || "(empty)");
      console.log();
      console.log("Personality:");
      console.log(card.data.personality || "(empty)");
      if (card.data.scenario) {
        console.log();
        console.log("Scenario:");
        console.log(card.data.scenario);
      }
      if (card.data.system_prompt) {
        console.log();
        console.log("System Prompt:");
        console.log(card.data.system_prompt);
      }
    });

  // Activate character card
  character
    .command("activate <name>")
    .alias("use")
    .description("Activate a character card")
    .action(async (name: string) => {
      const success = await setActiveCharacterCardByName(name);
      if (!success) {
        console.error(`❌ Character card not found: ${name}`);
        process.exitCode = 1;
        return;
      }
      console.log(`✅ Activated character card: ${name}`);
    });

  // Deactivate character card
  character
    .command("deactivate")
    .description("Deactivate the current character card")
    .action(async () => {
      const activeName = await getActiveCharacterName();
      if (!activeName) {
        console.log("No character card is currently active.");
        return;
      }
      await deactivateCharacterCard();
      console.log(`✅ Deactivated character card: ${activeName}`);
    });

  // Delete character card
  character
    .command("delete <name>")
    .alias("rm")
    .description("Delete a character card")
    .option("-f, --force", "Skip confirmation")
    .action(async (name: string, options: { force?: boolean }) => {
      const card = await getCharacterCardByName(name);
      if (!card) {
        console.error(`❌ Character card not found: ${name}`);
        process.exitCode = 1;
        return;
      }

      if (!options.force) {
        console.log(`This will delete character card: ${name}`);
        console.log("Use --force to skip this confirmation.");
        return;
      }

      const success = await deleteCharacterCardByName(name);
      if (success) {
        console.log(`✅ Deleted character card: ${name}`);
      } else {
        console.error(`❌ Failed to delete character card: ${name}`);
        process.exitCode = 1;
      }
    });

  // ============================================================================
  // World Info Commands
  // ============================================================================

  const worldinfo = sillytavern
    .command("worldinfo")
    .alias("wi")
    .description("Manage world info (lorebooks)");

  // Import world info
  worldinfo
    .command("import <file>")
    .description("Import a world info book from a JSON file")
    .action(async (file: string) => {
      const filePath = path.resolve(file);
      console.log(`Importing world info from: ${filePath}`);

      const result = await importWorldInfo(filePath);
      if (!result.success) {
        console.error(`❌ Failed to import: ${result.error}`);
        process.exitCode = 1;
        return;
      }

      const book = result.data!;
      const entryCount = Object.keys(book.entries).length;
      console.log(`✅ Imported world info: ${book.name}`);
      console.log(`   ID: ${book.id}`);
      console.log(`   Entries: ${entryCount}`);
      console.log(`   Enabled: ${book.enabled ? "Yes" : "No"}`);
    });

  // List world info books
  worldinfo
    .command("list")
    .alias("ls")
    .description("List all imported world info books")
    .option("--json", "Output as JSON")
    .action(async (options: { json?: boolean }) => {
      const books = await listWorldInfoBooks();

      if (options.json) {
        console.log(JSON.stringify({ books }, null, 2));
        return;
      }

      if (books.length === 0) {
        console.log("No world info books imported yet.");
        console.log("Use 'openclaw sillytavern worldinfo import <file>' to import one.");
        return;
      }

      console.log(`World Info Books (${books.length}):\n`);
      for (const book of books) {
        const enabledMarker = book.enabled ? " ✓ (enabled)" : " ✗ (disabled)";
        console.log(`  ${book.name}${enabledMarker}`);
        console.log(`    ID: ${book.id}`);
        console.log(`    Entries: ${book.entryCount}`);
        console.log();
      }
    });

  // Show world info book details
  worldinfo
    .command("show <name>")
    .description("Show details of a world info book")
    .option("--json", "Output as JSON")
    .option("--entries", "Show all entries")
    .action(async (name: string, options: { json?: boolean; entries?: boolean }) => {
      const book = await getWorldInfoBookByName(name);
      if (!book) {
        console.error(`❌ World info book not found: ${name}`);
        process.exitCode = 1;
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(book, null, 2));
        return;
      }

      const summary = getWorldInfoSummary(book);
      console.log(`World Info: ${summary.name}`);
      console.log(`Enabled: ${book.enabled ? "Yes" : "No"}`);
      console.log(`Total Entries: ${summary.entryCount}`);
      console.log(`Enabled Entries: ${summary.enabledCount}`);
      console.log(`Constant Entries: ${summary.constantCount}`);

      if (options.entries) {
        console.log("\nEntries:");
        for (const [uid, entry] of Object.entries(book.entries)) {
          const status = entry.disable ? "✗" : entry.constant ? "★" : "✓";
          const keys = entry.key.join(", ");
          console.log(`  [${status}] ${uid}: ${entry.comment || keys}`);
          if (entry.key.length > 0) {
            console.log(`      Keys: ${keys}`);
          }
          if (entry.keysecondary.length > 0) {
            console.log(`      Secondary: ${entry.keysecondary.join(", ")}`);
          }
        }
      }
    });

  // Enable world info book
  worldinfo
    .command("enable <name>")
    .description("Enable a world info book")
    .action(async (name: string) => {
      const success = await enableWorldInfoBook(name);
      if (!success) {
        console.error(`❌ World info book not found: ${name}`);
        process.exitCode = 1;
        return;
      }
      console.log(`✅ Enabled world info book: ${name}`);
    });

  // Disable world info book
  worldinfo
    .command("disable <name>")
    .description("Disable a world info book")
    .action(async (name: string) => {
      const success = await disableWorldInfoBook(name);
      if (!success) {
        console.error(`❌ World info book not found: ${name}`);
        process.exitCode = 1;
        return;
      }
      console.log(`✅ Disabled world info book: ${name}`);
    });

  // Delete world info book
  worldinfo
    .command("delete <name>")
    .alias("rm")
    .description("Delete a world info book")
    .option("-f, --force", "Skip confirmation")
    .action(async (name: string, options: { force?: boolean }) => {
      const book = await getWorldInfoBookByName(name);
      if (!book) {
        console.error(`❌ World info book not found: ${name}`);
        process.exitCode = 1;
        return;
      }

      if (!options.force) {
        console.log(`This will delete world info book: ${name}`);
        console.log("Use --force to skip this confirmation.");
        return;
      }

      const success = await deleteWorldInfoBookByName(name);
      if (success) {
        console.log(`✅ Deleted world info book: ${name}`);
      } else {
        console.error(`❌ Failed to delete world info book: ${name}`);
        process.exitCode = 1;
      }
    });

  // ============================================================================
  // Preset Commands
  // ============================================================================

  const preset = sillytavern
    .command("preset")
    .description("Manage presets");

  // Import preset
  preset
    .command("import <file>")
    .description("Import a preset from a JSON file")
    .action(async (file: string) => {
      const filePath = path.resolve(file);
      console.log(`Importing preset from: ${filePath}`);

      const result = await importPreset(filePath);
      if (!result.success) {
        console.error(`❌ Failed to import: ${result.error}`);
        process.exitCode = 1;
        return;
      }

      const presetData = result.data!;
      console.log(`✅ Imported preset: ${presetData.name}`);
      console.log(`   ID: ${presetData.id}`);
      console.log(`   Prompts: ${presetData.data.prompts.length}`);
    });

  // List presets
  preset
    .command("list")
    .alias("ls")
    .description("List all imported presets")
    .option("--json", "Output as JSON")
    .action(async (options: { json?: boolean }) => {
      const presets = await listPresets();
      const activeName = await getActivePresetName();

      if (options.json) {
        console.log(JSON.stringify({ presets, active: activeName }, null, 2));
        return;
      }

      if (presets.length === 0) {
        console.log("No presets imported yet.");
        console.log("Use 'openclaw sillytavern preset import <file>' to import one.");
        return;
      }

      console.log(`Presets (${presets.length}):\n`);
      for (const p of presets) {
        const isActive = p.name === activeName;
        const activeMarker = isActive ? " ✓ (active)" : "";
        console.log(`  ${p.name}${activeMarker}`);
        console.log(`    ID: ${p.id}`);
        console.log(`    Prompts: ${p.promptCount}`);
        console.log();
      }
    });

  // Show preset details
  preset
    .command("show <name>")
    .description("Show details of a preset")
    .option("--json", "Output as JSON")
    .option("--prompts", "Show all prompt entries")
    .action(async (name: string, options: { json?: boolean; prompts?: boolean }) => {
      const presetData = await getPresetByName(name);
      if (!presetData) {
        console.error(`❌ Preset not found: ${name}`);
        process.exitCode = 1;
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(presetData, null, 2));
        return;
      }

      const summary = getPresetSummary(presetData);
      console.log(`Preset: ${summary.name}`);
      console.log(`Total Prompts: ${summary.promptCount}`);
      console.log(`Enabled Prompts: ${summary.enabledCount}`);
      console.log(`System Prompts: ${summary.systemPromptCount}`);
      console.log(`Temperature: ${summary.temperature}`);
      console.log(`Max Context: ${summary.maxContext}`);

      if (options.prompts) {
        console.log("\nPrompt Entries:");
        for (const prompt of presetData.data.prompts) {
          const status = prompt.enabled ? "✓" : "✗";
          const role = prompt.role.charAt(0).toUpperCase();
          console.log(`  [${status}] ${prompt.identifier} (${role}): ${prompt.name}`);
          if (prompt.content) {
            const preview = prompt.content.substring(0, 60).replace(/\n/g, " ");
            console.log(`      ${preview}${prompt.content.length > 60 ? "..." : ""}`);
          }
        }
      }
    });

  // Activate preset
  preset
    .command("activate <name>")
    .alias("use")
    .description("Activate a preset")
    .action(async (name: string) => {
      const success = await setActivePresetByName(name);
      if (!success) {
        console.error(`❌ Preset not found: ${name}`);
        process.exitCode = 1;
        return;
      }
      console.log(`✅ Activated preset: ${name}`);
    });

  // Deactivate preset
  preset
    .command("deactivate")
    .description("Deactivate the current preset")
    .action(async () => {
      const activeName = await getActivePresetName();
      if (!activeName) {
        console.log("No preset is currently active.");
        return;
      }
      await deactivatePreset();
      console.log(`✅ Deactivated preset: ${activeName}`);
    });

  // Toggle prompt entry
  preset
    .command("toggle <preset> <identifier> <enabled>")
    .description("Toggle a prompt entry's enabled state")
    .action(async (presetName: string, identifier: string, enabled: string) => {
      const isEnabled = enabled === "true" || enabled === "1" || enabled === "on";
      const success = await togglePresetPrompt(presetName, identifier, isEnabled);
      if (!success) {
        console.error(`❌ Preset or prompt not found: ${presetName}/${identifier}`);
        process.exitCode = 1;
        return;
      }
      console.log(`✅ Set ${identifier} to ${isEnabled ? "enabled" : "disabled"}`);
    });

  // Delete preset
  preset
    .command("delete <name>")
    .alias("rm")
    .description("Delete a preset")
    .option("-f, --force", "Skip confirmation")
    .action(async (name: string, options: { force?: boolean }) => {
      const presetData = await getPresetByName(name);
      if (!presetData) {
        console.error(`❌ Preset not found: ${name}`);
        process.exitCode = 1;
        return;
      }

      if (!options.force) {
        console.log(`This will delete preset: ${name}`);
        console.log("Use --force to skip this confirmation.");
        return;
      }

      const success = await deletePresetByName(name);
      if (success) {
        console.log(`✅ Deleted preset: ${name}`);
      } else {
        console.error(`❌ Failed to delete preset: ${name}`);
        process.exitCode = 1;
      }
    });

  // ============================================================================
  // Memory Commands
  // ============================================================================

  const memory = sillytavern
    .command("memory")
    .alias("mem")
    .description("Manage long-term memories");

  // List memory books
  memory
    .command("list")
    .alias("ls")
    .description("List all memory books")
    .option("--json", "Output as JSON")
    .action((options: { json?: boolean }) => {
      const books = loadAllMemoryBooks();

      if (options.json) {
        console.log(JSON.stringify(books, null, 2));
        return;
      }

      if (books.length === 0) {
        console.log("No memory books found.");
        console.log("Memory books are created automatically when using characters.");
        return;
      }

      console.log(`Memory Books (${books.length}):\n`);
      for (const book of books) {
        const charInfo = book.characterId ? ` [char: ${book.characterId.slice(0, 8)}...]` : "";
        const sessionInfo = book.sessionKey ? ` [session: ${book.sessionKey}]` : "";
        console.log(`  📚 ${book.name}${charInfo}${sessionInfo}`);
        console.log(`     ID: ${book.id}`);
        console.log(`     Entries: ${book.entries.length}`);
        console.log(`     Created: ${book.createdAt}`);
        console.log(`     Updated: ${book.updatedAt}`);
        console.log();
      }
    });

  // Show memory book details
  memory
    .command("show <bookId>")
    .description("Show details of a memory book")
    .option("--json", "Output as JSON")
    .action((bookId: string, options: { json?: boolean }) => {
      const book = loadMemoryBook(bookId);

      if (!book) {
        console.error(`❌ Memory book not found: ${bookId}`);
        process.exitCode = 1;
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(book, null, 2));
        return;
      }

      console.log(`Memory Book: ${book.name}\n`);
      console.log(`ID: ${book.id}`);
      if (book.characterId) console.log(`Character ID: ${book.characterId}`);
      if (book.sessionKey) console.log(`Session Key: ${book.sessionKey}`);
      console.log(`Created: ${book.createdAt}`);
      console.log(`Updated: ${book.updatedAt}`);
      console.log(`\nSettings:`);
      console.log(`  Max Memories Per Request: ${book.settings.maxMemoriesPerRequest}`);
      console.log(`  Max Memory Tokens: ${book.settings.maxMemoryTokens}`);
      console.log(`  Use Keyword Retrieval: ${book.settings.useKeywordRetrieval}`);
      console.log(`  Auto Extract: ${book.settings.autoExtract}`);
      console.log(`  Min Importance: ${book.settings.minImportanceForInjection}`);
      console.log(`  Sort By: ${book.settings.sortBy}`);

      console.log(`\nMemories (${book.entries.length}):`);
      if (book.entries.length === 0) {
        console.log("  (no memories)");
      } else {
        for (const entry of book.entries) {
          const status = entry.enabled ? "✅" : "❌";
          const importance = entry.importance ?? 50;
          const category = entry.category ? `[${entry.category}] ` : "";
          console.log(`\n  ${status} ${category}${entry.content.slice(0, 80)}${entry.content.length > 80 ? "..." : ""}`);
          console.log(`     ID: ${entry.id}`);
          console.log(`     Type: ${entry.type} | Importance: ${importance} | Access Count: ${entry.accessCount}`);
          if (entry.keywords && entry.keywords.length > 0) {
            console.log(`     Keywords: ${entry.keywords.join(", ")}`);
          }
        }
      }
    });

  // Create memory book
  memory
    .command("create <name>")
    .description("Create a new memory book")
    .option("--character <id>", "Associate with character ID")
    .option("--session <key>", "Associate with session key")
    .action((name: string, options: { character?: string; session?: string }) => {
      const book = createMemoryBook({
        name,
        characterId: options.character,
        sessionKey: options.session,
      });

      console.log(`✅ Created memory book: ${book.name}`);
      console.log(`   ID: ${book.id}`);
    });

  // Add memory
  memory
    .command("add <bookId> <content>")
    .description("Add a memory to a book")
    .option("-k, --keywords <keywords>", "Comma-separated keywords")
    .option("-i, --importance <number>", "Importance score (0-100)", "50")
    .option("-c, --category <category>", "Memory category")
    .action((bookId: string, content: string, options: { keywords?: string; importance?: string; category?: string }) => {
      const keywords = options.keywords?.split(",").map((k) => k.trim());
      const importance = parseInt(options.importance ?? "50", 10);

      const entry = addMemory(bookId, {
        content,
        keywords,
        importance,
        category: options.category,
        type: "manual",
      });

      if (!entry) {
        console.error(`❌ Failed to add memory. Book not found: ${bookId}`);
        process.exitCode = 1;
        return;
      }

      console.log(`✅ Added memory: ${entry.id}`);
      console.log(`   Content: ${content.slice(0, 50)}${content.length > 50 ? "..." : ""}`);
      console.log(`   Importance: ${importance}`);
      if (keywords) console.log(`   Keywords: ${keywords.join(", ")}`);
    });

  // Update memory
  memory
    .command("update <bookId> <memoryId>")
    .description("Update a memory entry")
    .option("-c, --content <content>", "New content")
    .option("-k, --keywords <keywords>", "New comma-separated keywords")
    .option("-i, --importance <number>", "New importance score (0-100)")
    .option("--category <category>", "New category")
    .option("--enable", "Enable the memory")
    .option("--disable", "Disable the memory")
    .action((bookId: string, memoryId: string, options: {
      content?: string;
      keywords?: string;
      importance?: string;
      category?: string;
      enable?: boolean;
      disable?: boolean;
    }) => {
      const updates: Record<string, unknown> = {};

      if (options.content) updates.content = options.content;
      if (options.keywords) updates.keywords = options.keywords.split(",").map((k) => k.trim());
      if (options.importance) updates.importance = parseInt(options.importance, 10);
      if (options.category) updates.category = options.category;
      if (options.enable) updates.enabled = true;
      if (options.disable) updates.enabled = false;

      if (Object.keys(updates).length === 0) {
        console.error("❌ No updates specified. Use --content, --keywords, --importance, --category, --enable, or --disable.");
        process.exitCode = 1;
        return;
      }

      const entry = updateMemory(bookId, memoryId, updates);

      if (!entry) {
        console.error(`❌ Failed to update memory. Book or memory not found.`);
        process.exitCode = 1;
        return;
      }

      console.log(`✅ Updated memory: ${memoryId}`);
    });

  // Delete memory
  memory
    .command("remove <bookId> <memoryId>")
    .alias("rm")
    .description("Remove a memory from a book")
    .action((bookId: string, memoryId: string) => {
      const success = deleteMemory(bookId, memoryId);

      if (!success) {
        console.error(`❌ Failed to remove memory. Book or memory not found.`);
        process.exitCode = 1;
        return;
      }

      console.log(`✅ Removed memory: ${memoryId}`);
    });

  // Delete memory book
  memory
    .command("delete <bookId>")
    .description("Delete a memory book")
    .option("-f, --force", "Skip confirmation")
    .action((bookId: string, options: { force?: boolean }) => {
      const book = loadMemoryBook(bookId);

      if (!book) {
        console.error(`❌ Memory book not found: ${bookId}`);
        process.exitCode = 1;
        return;
      }

      if (!options.force && book.entries.length > 0) {
        console.log(`⚠️  Memory book "${book.name}" has ${book.entries.length} memories.`);
        console.log("Use --force to delete anyway.");
        return;
      }

      const success = deleteMemoryBook(bookId);

      if (success) {
        console.log(`✅ Deleted memory book: ${book.name}`);
      } else {
        console.error(`❌ Failed to delete memory book: ${bookId}`);
        process.exitCode = 1;
      }
    });

  // ============================================================================
  // Skills Commands
  // ============================================================================

  const skills = sillytavern
    .command("skills")
    .alias("skill")
    .description("Manage skills");

  // Import skill
  skills
    .command("import <file>")
    .description("Import a skill from a SKILL.md file")
    .option("--disabled", "Import as disabled")
    .action(async (file: string, options: { disabled?: boolean }) => {
      const filePath = path.resolve(file);
      console.log(`Importing skill from: ${filePath}`);

      try {
        const skill = await importSkill(filePath, { enabled: !options.disabled });
        console.log(`✅ Imported skill: ${skill.name}`);
        console.log(`   ID: ${skill.id}`);
        console.log(`   Description: ${skill.description}`);
        console.log(`   Enabled: ${skill.enabled}`);
      } catch (error) {
        console.error(`❌ Failed to import: ${error}`);
        process.exitCode = 1;
      }
    });

  // List skills
  skills
    .command("list")
    .alias("ls")
    .description("List all imported skills")
    .option("--enabled", "Show only enabled skills")
    .action(async (options: { enabled?: boolean }) => {
      const allSkills = await getAllSkills();

      if (allSkills.length === 0) {
        console.log("No skills imported yet.");
        console.log("Use `openclaw st skills import <file>` to import a skill.");
        return;
      }

      const filtered = options.enabled
        ? allSkills.filter((s) => s.enabled)
        : allSkills;

      console.log(`Skills (${filtered.length}/${allSkills.length}):\n`);

      for (const skill of filtered) {
        const status = skill.enabled ? "✓" : "○";
        const emoji = skill.metadata?.emoji ?? "🧩";
        console.log(`  ${status} ${emoji} ${skill.name}`);
        if (skill.description) {
          console.log(`      ${skill.description.slice(0, 60)}${skill.description.length > 60 ? "..." : ""}`);
        }
      }
    });

  // Show skill details
  skills
    .command("show <name>")
    .description("Show details of a skill")
    .action(async (name: string) => {
      const allSkills = await getAllSkills();
      const skill = allSkills.find(
        (s) => s.name.toLowerCase() === name.toLowerCase() || s.id === name,
      );

      if (!skill) {
        console.error(`❌ Skill not found: ${name}`);
        process.exitCode = 1;
        return;
      }

      const emoji = skill.metadata?.emoji ?? "🧩";
      console.log(`${emoji} ${skill.name}`);
      console.log(`${"─".repeat(40)}`);
      console.log(`ID: ${skill.id}`);
      console.log(`Description: ${skill.description}`);
      console.log(`Source: ${skill.source}`);
      console.log(`Enabled: ${skill.enabled}`);
      console.log(`Imported: ${skill.importedAt}`);
      console.log(`Path: ${skill.filePath}`);

      if (skill.metadata?.homepage) {
        console.log(`Homepage: ${skill.metadata.homepage}`);
      }
      if (skill.metadata?.primaryEnv) {
        console.log(`Primary Env: ${skill.metadata.primaryEnv}`);
      }
      if (skill.metadata?.requires) {
        const reqs = skill.metadata.requires;
        if (reqs.bins?.length) {
          console.log(`Required Bins: ${reqs.bins.join(", ")}`);
        }
        if (reqs.env?.length) {
          console.log(`Required Env: ${reqs.env.join(", ")}`);
        }
      }

      console.log(`\nContent Preview:`);
      console.log(`${"─".repeat(40)}`);
      console.log(skill.content.slice(0, 500) + (skill.content.length > 500 ? "..." : ""));
    });

  // Enable skill
  skills
    .command("enable <name>")
    .description("Enable a skill")
    .action(async (name: string) => {
      const allSkills = await getAllSkills();
      const skill = allSkills.find(
        (s) => s.name.toLowerCase() === name.toLowerCase() || s.id === name,
      );

      if (!skill) {
        console.error(`❌ Skill not found: ${name}`);
        process.exitCode = 1;
        return;
      }

      await setSkillEnabled(skill.id, true);
      console.log(`✅ Enabled skill: ${skill.name}`);
    });

  // Disable skill
  skills
    .command("disable <name>")
    .description("Disable a skill")
    .action(async (name: string) => {
      const allSkills = await getAllSkills();
      const skill = allSkills.find(
        (s) => s.name.toLowerCase() === name.toLowerCase() || s.id === name,
      );

      if (!skill) {
        console.error(`❌ Skill not found: ${name}`);
        process.exitCode = 1;
        return;
      }

      await setSkillEnabled(skill.id, false);
      console.log(`✅ Disabled skill: ${skill.name}`);
    });

  // Remove skill
  skills
    .command("remove <name>")
    .alias("rm")
    .description("Remove a skill")
    .option("-f, --force", "Force removal without confirmation")
    .action(async (name: string, options: { force?: boolean }) => {
      const allSkills = await getAllSkills();
      const skill = allSkills.find(
        (s) => s.name.toLowerCase() === name.toLowerCase() || s.id === name,
      );

      if (!skill) {
        console.error(`❌ Skill not found: ${name}`);
        process.exitCode = 1;
        return;
      }

      if (!options.force) {
        console.log(`⚠️  This will remove skill "${skill.name}".`);
        console.log("Use --force to confirm removal.");
        return;
      }

      await removeSkill(skill.id);
      console.log(`✅ Removed skill: ${skill.name}`);
    });

  // Sync skills from workspace
  skills
    .command("sync [workspace]")
    .description("Sync skills from workspace directory")
    .action(async (workspace?: string) => {
      const workspaceDir = workspace ? path.resolve(workspace) : process.cwd();
      console.log(`Syncing skills from: ${workspaceDir}`);

      try {
        const result = await syncSkillsFromWorkspace(workspaceDir);
        console.log(`✅ Sync complete:`);
        console.log(`   Added: ${result.added}`);
        console.log(`   Updated: ${result.updated}`);
        console.log(`   Removed: ${result.removed}`);
      } catch (error) {
        console.error(`❌ Failed to sync: ${error}`);
        process.exitCode = 1;
      }
    });

  // ============================================================================
  // Status Command
  // ============================================================================

  sillytavern
    .command("status")
    .description("Show SillyTavern plugin status")
    .action(async () => {
      const charStats = await getCharacterStorageStats();
      const wiStats = await getWorldInfoStorageStats();
      const presetStats = await getPresetStorageStats();
      const memoryBooks = loadAllMemoryBooks();
      const totalMemories = memoryBooks.reduce((sum, book) => sum + book.entries.length, 0);
      const skillsIndex = await loadSkillsIndex();
      const enabledSkills = skillsIndex.entries.filter((s) => s.enabled).length;

      console.log("SillyTavern Plugin Status\n");

      console.log("Character Cards:");
      console.log(`  Total: ${charStats.totalCards}`);
      console.log(`  Active: ${charStats.activeCard ?? "(none)"}`);

      console.log("\nWorld Info:");
      console.log(`  Total Books: ${wiStats.worldInfoCount}`);
      console.log(`  Enabled: ${wiStats.enabledCount}`);
      console.log(`  Total Entries: ${wiStats.totalEntries}`);

      console.log("\nPresets:");
      console.log(`  Total: ${presetStats.presetCount}`);
      console.log(`  Active: ${presetStats.activePreset ?? "(none)"}`);
      console.log(`  Total Prompts: ${presetStats.totalPrompts}`);

      console.log("\nMemories:");
      console.log(`  Total Books: ${memoryBooks.length}`);
      console.log(`  Total Memories: ${totalMemories}`);

      console.log("\nSkills:");
      console.log(`  Total: ${skillsIndex.entries.length}`);
      console.log(`  Enabled: ${enabledSkills}`);

      console.log(`\nStorage: ${charStats.storageDir}`);
    });
}
