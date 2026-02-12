/**
 * Character Card Storage Manager
 * Handles storage, retrieval, and management of character cards
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { CharacterIndex, CharacterIndexEntry, StoredCharacterCard } from "../types.js";
import {
  parseCharacterCardJson,
  toStoredCharacterCard,
  type ParseResult,
} from "../parsers/character-card.js";

const STORAGE_DIR = ".openclaw/plugins/sillytavern";
const CHARACTERS_DIR = "characters";
const INDEX_FILE = "index.json";
const INDEX_VERSION = 1;

/**
 * Get the base storage directory
 * Unified path: ~/.openclaw/plugins/sillytavern/
 */
function getStorageDir(): string {
  return path.join(os.homedir(), STORAGE_DIR);
}

/**
 * Get the characters directory
 */
function getCharactersDir(): string {
  return path.join(getStorageDir(), CHARACTERS_DIR);
}

/**
 * Get the index file path
 */
function getIndexPath(): string {
  return path.join(getCharactersDir(), INDEX_FILE);
}

/**
 * Get the character file path
 */
function getCharacterPath(id: string): string {
  return path.join(getCharactersDir(), `${id}.json`);
}

/**
 * Ensure the storage directories exist
 */
async function ensureStorageDir(): Promise<void> {
  await fs.mkdir(getCharactersDir(), { recursive: true });
}

/**
 * Load the character index
 */
async function loadIndex(): Promise<CharacterIndex> {
  try {
    const content = await fs.readFile(getIndexPath(), "utf-8");
    const index = JSON.parse(content) as CharacterIndex;
    return index;
  } catch {
    // Return empty index if file doesn't exist
    return { version: INDEX_VERSION, entries: [] };
  }
}

/**
 * Save the character index
 */
async function saveIndex(index: CharacterIndex): Promise<void> {
  await ensureStorageDir();
  await fs.writeFile(getIndexPath(), JSON.stringify(index, null, 2), "utf-8");
}

/**
 * Import a character card from a file
 */
export async function importCharacterCard(
  filePath: string,
): Promise<ParseResult<StoredCharacterCard>> {
  // Read the file
  let content: string;
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch (e) {
    return {
      success: false,
      error: `Failed to read file: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Parse the character card
  const parseResult = parseCharacterCardJson(content);
  if (!parseResult.success || !parseResult.data) {
    return { success: false, error: parseResult.error };
  }

  // Convert to stored format
  const stored = toStoredCharacterCard(parseResult.data, filePath);

  // Save the character card
  await ensureStorageDir();
  await fs.writeFile(getCharacterPath(stored.id), JSON.stringify(stored, null, 2), "utf-8");

  // Update the index
  const index = await loadIndex();
  const existingIndex = index.entries.findIndex((e) => e.name === stored.name);
  const entry: CharacterIndexEntry = {
    id: stored.id,
    name: stored.name,
    spec: stored.spec,
    importedAt: stored.importedAt,
    tags: stored.data.tags,
  };

  if (existingIndex >= 0) {
    // Replace existing entry with same name
    const oldId = index.entries[existingIndex].id;
    index.entries[existingIndex] = entry;
    // Delete old file if ID changed
    if (oldId !== stored.id) {
      try {
        await fs.unlink(getCharacterPath(oldId));
      } catch {
        // Ignore if file doesn't exist
      }
    }
  } else {
    index.entries.push(entry);
  }

  await saveIndex(index);

  return { success: true, data: stored };
}

/**
 * Import a character card from JSON string
 */
export async function importCharacterCardFromJson(
  jsonString: string,
  sourceName?: string,
): Promise<ParseResult<StoredCharacterCard>> {
  // Parse the character card
  const parseResult = parseCharacterCardJson(jsonString);
  if (!parseResult.success || !parseResult.data) {
    return { success: false, error: parseResult.error };
  }

  // Convert to stored format
  const stored = toStoredCharacterCard(parseResult.data, sourceName);

  // Save the character card
  await ensureStorageDir();
  await fs.writeFile(getCharacterPath(stored.id), JSON.stringify(stored, null, 2), "utf-8");

  // Update the index
  const index = await loadIndex();
  const existingIndex = index.entries.findIndex((e) => e.name === stored.name);
  const entry: CharacterIndexEntry = {
    id: stored.id,
    name: stored.name,
    spec: stored.spec,
    importedAt: stored.importedAt,
    tags: stored.data.tags,
  };

  if (existingIndex >= 0) {
    const oldId = index.entries[existingIndex].id;
    index.entries[existingIndex] = entry;
    if (oldId !== stored.id) {
      try {
        await fs.unlink(getCharacterPath(oldId));
      } catch {
        // Ignore
      }
    }
  } else {
    index.entries.push(entry);
  }

  await saveIndex(index);

  return { success: true, data: stored };
}

/**
 * List all character cards
 */
export async function listCharacterCards(): Promise<CharacterIndexEntry[]> {
  const index = await loadIndex();
  return index.entries;
}

/**
 * Get a character card by ID
 */
export async function getCharacterCard(id: string): Promise<StoredCharacterCard | null> {
  try {
    const content = await fs.readFile(getCharacterPath(id), "utf-8");
    return JSON.parse(content) as StoredCharacterCard;
  } catch {
    return null;
  }
}

/**
 * Get a character card by name
 */
export async function getCharacterCardByName(name: string): Promise<StoredCharacterCard | null> {
  const index = await loadIndex();
  const entry = index.entries.find((e) => e.name === name);
  if (!entry) {
    return null;
  }
  return getCharacterCard(entry.id);
}

/**
 * Delete a character card by ID
 */
export async function deleteCharacterCard(id: string): Promise<boolean> {
  const index = await loadIndex();
  const entryIndex = index.entries.findIndex((e) => e.id === id);
  if (entryIndex < 0) {
    return false;
  }

  // Remove from index
  index.entries.splice(entryIndex, 1);

  // Clear active if it was this card
  if (index.active === id) {
    index.active = undefined;
  }

  await saveIndex(index);

  // Delete the file
  try {
    await fs.unlink(getCharacterPath(id));
  } catch {
    // Ignore if file doesn't exist
  }

  return true;
}

/**
 * Delete a character card by name
 */
export async function deleteCharacterCardByName(name: string): Promise<boolean> {
  const index = await loadIndex();
  const entry = index.entries.find((e) => e.name === name);
  if (!entry) {
    return false;
  }
  return deleteCharacterCard(entry.id);
}

/**
 * Get the currently active character card
 */
export async function getActiveCharacterCard(): Promise<StoredCharacterCard | null> {
  const index = await loadIndex();
  if (!index.active) {
    return null;
  }
  return getCharacterCard(index.active);
}

/**
 * Get the active character card name
 */
export async function getActiveCharacterName(): Promise<string | null> {
  const index = await loadIndex();
  if (!index.active) {
    return null;
  }
  const entry = index.entries.find((e) => e.id === index.active);
  return entry?.name ?? null;
}

/**
 * Set the active character card by ID
 */
export async function setActiveCharacterCard(id: string): Promise<boolean> {
  const index = await loadIndex();
  const entry = index.entries.find((e) => e.id === id);
  if (!entry) {
    return false;
  }
  index.active = id;
  await saveIndex(index);
  return true;
}

/**
 * Set the active character card by name
 */
export async function setActiveCharacterCardByName(name: string): Promise<boolean> {
  const index = await loadIndex();
  const entry = index.entries.find((e) => e.name === name);
  if (!entry) {
    return false;
  }
  index.active = entry.id;
  await saveIndex(index);
  return true;
}

/**
 * Deactivate the current character card
 */
export async function deactivateCharacterCard(): Promise<void> {
  const index = await loadIndex();
  index.active = undefined;
  await saveIndex(index);
}

/**
 * Check if a character card exists by name
 */
export async function characterCardExists(name: string): Promise<boolean> {
  const index = await loadIndex();
  return index.entries.some((e) => e.name === name);
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  totalCards: number;
  activeCard: string | null;
  storageDir: string;
}> {
  const index = await loadIndex();
  const activeEntry = index.active ? index.entries.find((e) => e.id === index.active) : null;
  return {
    totalCards: index.entries.length,
    activeCard: activeEntry?.name ?? null,
    storageDir: getCharactersDir(),
  };
}
