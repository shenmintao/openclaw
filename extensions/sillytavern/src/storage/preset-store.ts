/**
 * Preset Storage Manager
 * Handles storage, retrieval, and management of presets
 */

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { PresetIndex, PresetIndexEntry, StoredPreset } from "../types.js";
import {
  parsePresetJson,
  toStoredPreset,
  type ParseResult,
} from "../parsers/preset.js";

const STORAGE_DIR = ".openclaw/sillytavern";
const PRESETS_DIR = "presets";
const INDEX_FILE = "index.json";
const INDEX_VERSION = 1;

/**
 * Get the base storage directory
 */
function getStorageDir(): string {
  return path.join(os.homedir(), STORAGE_DIR);
}

/**
 * Get the presets directory
 */
function getPresetsDir(): string {
  return path.join(getStorageDir(), PRESETS_DIR);
}

/**
 * Get the index file path
 */
function getIndexPath(): string {
  return path.join(getPresetsDir(), INDEX_FILE);
}

/**
 * Get the preset file path
 */
function getPresetPath(id: string): string {
  return path.join(getPresetsDir(), `${id}.json`);
}

/**
 * Ensure the storage directories exist
 */
async function ensureStorageDir(): Promise<void> {
  await fs.mkdir(getPresetsDir(), { recursive: true });
}

/**
 * Load the preset index
 */
async function loadIndex(): Promise<PresetIndex> {
  try {
    const content = await fs.readFile(getIndexPath(), "utf-8");
    const index = JSON.parse(content) as PresetIndex;
    return index;
  } catch {
    // Return empty index if file doesn't exist
    return { version: INDEX_VERSION, entries: [] };
  }
}

/**
 * Save the preset index
 */
async function saveIndex(index: PresetIndex): Promise<void> {
  await ensureStorageDir();
  await fs.writeFile(getIndexPath(), JSON.stringify(index, null, 2), "utf-8");
}

/**
 * Import a preset from a file
 */
export async function importPreset(
  filePath: string,
): Promise<ParseResult<StoredPreset>> {
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

  // Parse the preset
  const parseResult = parsePresetJson(content);
  if (!parseResult.success || !parseResult.data) {
    return { success: false, error: parseResult.error };
  }

  // Convert to stored format
  const stored = toStoredPreset(parseResult.data.name, parseResult.data.preset, filePath);

  // Save the preset
  await ensureStorageDir();
  await fs.writeFile(getPresetPath(stored.id), JSON.stringify(stored, null, 2), "utf-8");

  // Update the index
  const index = await loadIndex();
  const existingIndex = index.entries.findIndex((e) => e.name === stored.name);
  const entry: PresetIndexEntry = {
    id: stored.id,
    name: stored.name,
    importedAt: stored.importedAt,
    promptCount: stored.data.prompts.length,
  };

  if (existingIndex >= 0) {
    // Replace existing entry with same name
    const oldId = index.entries[existingIndex].id;
    index.entries[existingIndex] = entry;
    // Delete old file if ID changed
    if (oldId !== stored.id) {
      try {
        await fs.unlink(getPresetPath(oldId));
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
 * Import a preset from JSON string
 */
export async function importPresetFromJson(
  jsonString: string,
  sourceName?: string,
): Promise<ParseResult<StoredPreset>> {
  // Parse the preset
  const parseResult = parsePresetJson(jsonString);
  if (!parseResult.success || !parseResult.data) {
    return { success: false, error: parseResult.error };
  }

  // Use provided name or parsed name
  const name = sourceName || parseResult.data.name;

  // Convert to stored format
  const stored = toStoredPreset(name, parseResult.data.preset);

  // Save the preset
  await ensureStorageDir();
  await fs.writeFile(getPresetPath(stored.id), JSON.stringify(stored, null, 2), "utf-8");

  // Update the index
  const index = await loadIndex();
  const existingIndex = index.entries.findIndex((e) => e.name === stored.name);
  const entry: PresetIndexEntry = {
    id: stored.id,
    name: stored.name,
    importedAt: stored.importedAt,
    promptCount: stored.data.prompts.length,
  };

  if (existingIndex >= 0) {
    const oldId = index.entries[existingIndex].id;
    index.entries[existingIndex] = entry;
    if (oldId !== stored.id) {
      try {
        await fs.unlink(getPresetPath(oldId));
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
 * List all presets
 */
export async function listPresets(): Promise<PresetIndexEntry[]> {
  const index = await loadIndex();
  return index.entries;
}

/**
 * Get a preset by ID
 */
export async function getPreset(id: string): Promise<StoredPreset | null> {
  try {
    const content = await fs.readFile(getPresetPath(id), "utf-8");
    return JSON.parse(content) as StoredPreset;
  } catch {
    return null;
  }
}

/**
 * Get a preset by name
 */
export async function getPresetByName(name: string): Promise<StoredPreset | null> {
  const index = await loadIndex();
  const entry = index.entries.find((e) => e.name === name);
  if (!entry) {
    return null;
  }
  return getPreset(entry.id);
}

/**
 * Delete a preset by name
 */
export async function deletePresetByName(name: string): Promise<boolean> {
  const index = await loadIndex();
  const entryIndex = index.entries.findIndex((e) => e.name === name);
  if (entryIndex < 0) {
    return false;
  }

  const entry = index.entries[entryIndex];

  // Delete the file
  try {
    await fs.unlink(getPresetPath(entry.id));
  } catch {
    // Ignore if file doesn't exist
  }

  // Update the index
  index.entries.splice(entryIndex, 1);

  // Clear active if this was the active preset
  if (index.active === name) {
    index.active = undefined;
  }

  await saveIndex(index);

  return true;
}

/**
 * Set the active preset by name
 */
export async function setActivePresetByName(name: string): Promise<boolean> {
  const index = await loadIndex();
  const entry = index.entries.find((e) => e.name === name);
  if (!entry) {
    return false;
  }

  index.active = name;
  await saveIndex(index);

  return true;
}

/**
 * Deactivate the current preset
 */
export async function deactivatePreset(): Promise<void> {
  const index = await loadIndex();
  index.active = undefined;
  await saveIndex(index);
}

/**
 * Get the active preset name
 */
export async function getActivePresetName(): Promise<string | undefined> {
  const index = await loadIndex();
  return index.active;
}

/**
 * Get the active preset
 */
export async function getActivePreset(): Promise<StoredPreset | null> {
  const activeName = await getActivePresetName();
  if (!activeName) {
    return null;
  }
  return getPresetByName(activeName);
}

/**
 * Toggle a prompt entry's enabled state within a preset
 */
export async function togglePresetPrompt(
  presetName: string,
  promptIdentifier: string,
  enabled: boolean,
): Promise<boolean> {
  const preset = await getPresetByName(presetName);
  if (!preset) {
    return false;
  }

  // Check if prompt exists
  const promptExists = preset.data.prompts.some((p) => p.identifier === promptIdentifier);
  if (!promptExists) {
    return false;
  }

  // Initialize entryOverrides if needed
  if (!preset.entryOverrides) {
    preset.entryOverrides = {};
  }

  // Set the override
  preset.entryOverrides[promptIdentifier] = { enabled };

  // Save the preset
  await fs.writeFile(getPresetPath(preset.id), JSON.stringify(preset, null, 2), "utf-8");

  return true;
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  presetCount: number;
  activePreset: string | undefined;
  totalPrompts: number;
}> {
  const index = await loadIndex();
  const totalPrompts = index.entries.reduce((sum, e) => sum + e.promptCount, 0);

  return {
    presetCount: index.entries.length,
    activePreset: index.active,
    totalPrompts,
  };
}
