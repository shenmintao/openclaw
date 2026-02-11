/**
 * World Info Storage Manager
 * Handles storage, retrieval, and management of world info books
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { WorldInfoIndex, WorldInfoIndexEntry, StoredWorldInfoBook } from "../types.js";
import {
  parseWorldInfoJson,
  toStoredWorldInfoBook,
  type ParseResult,
} from "../parsers/world-info.js";

const STORAGE_DIR = ".openclaw/sillytavern";
const WORLDINFO_DIR = "worldinfo";
const INDEX_FILE = "index.json";
const INDEX_VERSION = 1;

/**
 * Get the base storage directory
 */
function getStorageDir(): string {
  return path.join(os.homedir(), STORAGE_DIR);
}

/**
 * Get the world info directory
 */
function getWorldInfoDir(): string {
  return path.join(getStorageDir(), WORLDINFO_DIR);
}

/**
 * Get the index file path
 */
function getIndexPath(): string {
  return path.join(getWorldInfoDir(), INDEX_FILE);
}

/**
 * Get the world info file path
 */
function getWorldInfoPath(id: string): string {
  return path.join(getWorldInfoDir(), `${id}.json`);
}

/**
 * Ensure the storage directories exist
 */
async function ensureStorageDir(): Promise<void> {
  await fs.mkdir(getWorldInfoDir(), { recursive: true });
}

/**
 * Load the world info index
 */
async function loadIndex(): Promise<WorldInfoIndex> {
  try {
    const content = await fs.readFile(getIndexPath(), "utf-8");
    const index = JSON.parse(content) as WorldInfoIndex;
    return index;
  } catch {
    // Return empty index if file doesn't exist
    return { version: INDEX_VERSION, entries: [] };
  }
}

/**
 * Save the world info index
 */
async function saveIndex(index: WorldInfoIndex): Promise<void> {
  await ensureStorageDir();
  await fs.writeFile(getIndexPath(), JSON.stringify(index, null, 2), "utf-8");
}

/**
 * Import a world info book from a file
 */
export async function importWorldInfo(
  filePath: string,
): Promise<ParseResult<StoredWorldInfoBook>> {
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

  // Parse the world info
  const parseResult = parseWorldInfoJson(content);
  if (!parseResult.success || !parseResult.data) {
    return { success: false, error: parseResult.error };
  }

  // Convert to stored format
  const stored = toStoredWorldInfoBook(parseResult.data.name, parseResult.data.book, filePath);

  // Save the world info book
  await ensureStorageDir();
  await fs.writeFile(getWorldInfoPath(stored.id), JSON.stringify(stored, null, 2), "utf-8");

  // Update the index
  const index = await loadIndex();
  const existingIndex = index.entries.findIndex((e) => e.name === stored.name);
  const entry: WorldInfoIndexEntry = {
    id: stored.id,
    name: stored.name,
    importedAt: stored.importedAt,
    enabled: stored.enabled,
    entryCount: Object.keys(stored.entries).length,
  };

  if (existingIndex >= 0) {
    // Replace existing entry with same name
    const oldId = index.entries[existingIndex].id;
    index.entries[existingIndex] = entry;
    // Delete old file if ID changed
    if (oldId !== stored.id) {
      try {
        await fs.unlink(getWorldInfoPath(oldId));
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
 * Import a world info book from JSON string
 */
export async function importWorldInfoFromJson(
  jsonString: string,
  sourceName?: string,
): Promise<ParseResult<StoredWorldInfoBook>> {
  // Parse the world info
  const parseResult = parseWorldInfoJson(jsonString);
  if (!parseResult.success || !parseResult.data) {
    return { success: false, error: parseResult.error };
  }

  // Use provided name or parsed name
  const name = sourceName || parseResult.data.name;

  // Convert to stored format
  const stored = toStoredWorldInfoBook(name, parseResult.data.book);

  // Save the world info book
  await ensureStorageDir();
  await fs.writeFile(getWorldInfoPath(stored.id), JSON.stringify(stored, null, 2), "utf-8");

  // Update the index
  const index = await loadIndex();
  const existingIndex = index.entries.findIndex((e) => e.name === stored.name);
  const entry: WorldInfoIndexEntry = {
    id: stored.id,
    name: stored.name,
    importedAt: stored.importedAt,
    enabled: stored.enabled,
    entryCount: Object.keys(stored.entries).length,
  };

  if (existingIndex >= 0) {
    const oldId = index.entries[existingIndex].id;
    index.entries[existingIndex] = entry;
    if (oldId !== stored.id) {
      try {
        await fs.unlink(getWorldInfoPath(oldId));
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
 * List all world info books
 */
export async function listWorldInfoBooks(): Promise<WorldInfoIndexEntry[]> {
  const index = await loadIndex();
  return index.entries;
}

/**
 * Get a world info book by ID
 */
export async function getWorldInfoBook(id: string): Promise<StoredWorldInfoBook | null> {
  try {
    const content = await fs.readFile(getWorldInfoPath(id), "utf-8");
    return JSON.parse(content) as StoredWorldInfoBook;
  } catch {
    return null;
  }
}

/**
 * Get a world info book by name
 */
export async function getWorldInfoBookByName(name: string): Promise<StoredWorldInfoBook | null> {
  const index = await loadIndex();
  const entry = index.entries.find((e) => e.name === name);
  if (!entry) {
    return null;
  }
  return getWorldInfoBook(entry.id);
}

/**
 * Delete a world info book by name
 */
export async function deleteWorldInfoBookByName(name: string): Promise<boolean> {
  const index = await loadIndex();
  const entryIndex = index.entries.findIndex((e) => e.name === name);
  if (entryIndex < 0) {
    return false;
  }

  const entry = index.entries[entryIndex];

  // Delete the file
  try {
    await fs.unlink(getWorldInfoPath(entry.id));
  } catch {
    // Ignore if file doesn't exist
  }

  // Update the index
  index.entries.splice(entryIndex, 1);
  await saveIndex(index);

  return true;
}

/**
 * Enable a world info book by name
 */
export async function enableWorldInfoBook(name: string): Promise<boolean> {
  const index = await loadIndex();
  const entryIndex = index.entries.findIndex((e) => e.name === name);
  if (entryIndex < 0) {
    return false;
  }

  // Update index
  index.entries[entryIndex].enabled = true;
  await saveIndex(index);

  // Update stored book
  const book = await getWorldInfoBook(index.entries[entryIndex].id);
  if (book) {
    book.enabled = true;
    await fs.writeFile(getWorldInfoPath(book.id), JSON.stringify(book, null, 2), "utf-8");
  }

  return true;
}

/**
 * Disable a world info book by name
 */
export async function disableWorldInfoBook(name: string): Promise<boolean> {
  const index = await loadIndex();
  const entryIndex = index.entries.findIndex((e) => e.name === name);
  if (entryIndex < 0) {
    return false;
  }

  // Update index
  index.entries[entryIndex].enabled = false;
  await saveIndex(index);

  // Update stored book
  const book = await getWorldInfoBook(index.entries[entryIndex].id);
  if (book) {
    book.enabled = false;
    await fs.writeFile(getWorldInfoPath(book.id), JSON.stringify(book, null, 2), "utf-8");
  }

  return true;
}

/**
 * Get all enabled world info books
 */
export async function getEnabledWorldInfoBooks(): Promise<StoredWorldInfoBook[]> {
  const index = await loadIndex();
  const enabledEntries = index.entries.filter((e) => e.enabled);

  const books: StoredWorldInfoBook[] = [];
  for (const entry of enabledEntries) {
    const book = await getWorldInfoBook(entry.id);
    if (book) {
      books.push(book);
    }
  }

  return books;
}

/**
 * Toggle entry enabled state within a world info book
 */
export async function toggleWorldInfoEntry(
  bookName: string,
  entryUid: number,
  enabled: boolean,
): Promise<boolean> {
  const book = await getWorldInfoBookByName(bookName);
  if (!book) {
    return false;
  }

  const uidStr = String(entryUid);
  if (!book.entries[uidStr]) {
    return false;
  }

  // Initialize entryOverrides if needed
  if (!book.entryOverrides) {
    book.entryOverrides = {};
  }

  // Set the override
  book.entryOverrides[entryUid] = { disabled: !enabled };

  // Save the book
  await fs.writeFile(getWorldInfoPath(book.id), JSON.stringify(book, null, 2), "utf-8");

  return true;
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  worldInfoCount: number;
  enabledCount: number;
  totalEntries: number;
}> {
  const index = await loadIndex();
  const enabledCount = index.entries.filter((e) => e.enabled).length;
  const totalEntries = index.entries.reduce((sum, e) => sum + e.entryCount, 0);

  return {
    worldInfoCount: index.entries.length,
    enabledCount,
    totalEntries,
  };
}
