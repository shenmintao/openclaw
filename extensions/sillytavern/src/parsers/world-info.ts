/**
 * World Info (Lorebook) Parser
 * Parses SillyTavern world info/lorebook files and handles keyword-based activation
 */

import type {
  WorldInfoBook,
  WorldInfoEntry,
  StoredWorldInfoBook,
  WorldInfoConfig,
  CharacterFilter,
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
 * Activation result for a world info entry
 */
export interface ActivationResult {
  entry: WorldInfoEntry;
  uid: string;
  activated: boolean;
  matchedKeys: string[];
  probability?: number;
}

/**
 * Parse a world info JSON string
 */
export function parseWorldInfoJson(jsonString: string): ParseResult<{ name: string; book: WorldInfoBook }> {
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
    return { success: false, error: "World info must be an object" };
  }

  const obj = parsed as Record<string, unknown>;

  // Check for entries field
  if (!obj.entries || typeof obj.entries !== "object") {
    return { success: false, error: "World info must have an 'entries' object" };
  }

  // Parse entries - can be object or array
  const entries: Record<string, WorldInfoEntry> = {};
  const entriesObj = obj.entries as Record<string, unknown>;

  if (Array.isArray(entriesObj)) {
    // Array format - convert to object keyed by uid
    for (const entry of entriesObj) {
      const parsed = parseWorldInfoEntry(entry);
      if (parsed) {
        entries[String(parsed.uid)] = parsed;
      }
    }
  } else {
    // Object format (keyed by uid)
    for (const [key, value] of Object.entries(entriesObj)) {
      const parsed = parseWorldInfoEntry(value, parseInt(key, 10));
      if (parsed) {
        entries[key] = parsed;
      }
    }
  }

  const name = typeof obj.name === "string" ? obj.name : "Unnamed World Info";

  const worldInfo: WorldInfoBook = {
    entries,
  };

  return { success: true, data: { name, book: worldInfo } };
}

/**
 * Parse a single world info entry
 */
function parseWorldInfoEntry(entry: unknown, defaultUid?: number): WorldInfoEntry | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const obj = entry as Record<string, unknown>;

  // Parse keys - can be array or comma-separated string
  let keys: string[] = [];
  if (Array.isArray(obj.key)) {
    keys = obj.key.filter((k): k is string => typeof k === "string");
  } else if (typeof obj.key === "string") {
    keys = obj.key.split(",").map((k) => k.trim()).filter(Boolean);
  } else if (Array.isArray(obj.keys)) {
    keys = obj.keys.filter((k): k is string => typeof k === "string");
  }

  // Parse secondary keys
  let keysecondary: string[] = [];
  if (Array.isArray(obj.keysecondary)) {
    keysecondary = obj.keysecondary.filter((k): k is string => typeof k === "string");
  } else if (typeof obj.keysecondary === "string") {
    keysecondary = obj.keysecondary.split(",").map((k) => k.trim()).filter(Boolean);
  }

  // Content is required
  const content = typeof obj.content === "string" ? obj.content : "";
  if (!content && keys.length === 0) {
    return null; // Skip empty entries
  }

  // Parse character filter
  const characterFilter = parseCharacterFilter(obj.characterFilter);

  return {
    uid: typeof obj.uid === "number" ? obj.uid : (defaultUid ?? 0),
    key: keys,
    keysecondary,
    comment: typeof obj.comment === "string" ? obj.comment : "",
    content,
    // Activation control
    constant: obj.constant === true,
    selective: obj.selective === true,
    selectiveLogic: typeof obj.selectiveLogic === "number" ? obj.selectiveLogic : 0,
    disable: obj.disable === true || obj.enabled === false,
    // Probability
    probability: typeof obj.probability === "number" ? obj.probability : 100,
    useProbability: obj.useProbability === true,
    // Position and order
    order: typeof obj.order === "number" ? obj.order : 100,
    position: typeof obj.position === "number" ? obj.position : 0,
    depth: typeof obj.depth === "number" ? obj.depth : 4,
    displayIndex: typeof obj.displayIndex === "number" ? obj.displayIndex : 0,
    // Scan settings
    scanDepth: typeof obj.scanDepth === "number" ? obj.scanDepth : null,
    caseSensitive: typeof obj.caseSensitive === "boolean" ? obj.caseSensitive : null,
    matchWholeWords: typeof obj.matchWholeWords === "boolean" ? obj.matchWholeWords : null,
    // Recursion
    excludeRecursion: obj.excludeRecursion === true,
    preventRecursion: obj.preventRecursion === true,
    delayUntilRecursion: obj.delayUntilRecursion === true,
    // Grouping
    group: typeof obj.group === "string" ? obj.group : "",
    groupOverride: obj.groupOverride === true,
    groupWeight: typeof obj.groupWeight === "number" ? obj.groupWeight : 100,
    useGroupScoring: typeof obj.useGroupScoring === "boolean" ? obj.useGroupScoring : null,
    // Match scope
    matchPersonaDescription: obj.matchPersonaDescription === true,
    matchCharacterDescription: obj.matchCharacterDescription === true,
    matchCharacterPersonality: obj.matchCharacterPersonality === true,
    matchCharacterDepthPrompt: obj.matchCharacterDepthPrompt === true,
    matchScenario: obj.matchScenario === true,
    matchCreatorNotes: obj.matchCreatorNotes === true,
    // Advanced
    role: typeof obj.role === "number" ? obj.role : null,
    vectorized: obj.vectorized === true,
    automationId: typeof obj.automationId === "string" ? obj.automationId : "",
    sticky: typeof obj.sticky === "number" ? obj.sticky : 0,
    cooldown: typeof obj.cooldown === "number" ? obj.cooldown : 0,
    delay: typeof obj.delay === "number" ? obj.delay : 0,
    ignoreBudget: obj.ignoreBudget === true,
    // Triggers and filters
    triggers: Array.isArray(obj.triggers) ? obj.triggers.filter((t): t is string => typeof t === "string") : [],
    characterFilter,
    outletName: typeof obj.outletName === "string" ? obj.outletName : "",
    addMemo: obj.addMemo === true,
  };
}

/**
 * Parse character filter
 */
function parseCharacterFilter(filter: unknown): CharacterFilter {
  if (!filter || typeof filter !== "object") {
    return { isExclude: false, names: [], tags: [] };
  }

  const obj = filter as Record<string, unknown>;
  return {
    isExclude: obj.isExclude === true,
    names: Array.isArray(obj.names) ? obj.names.filter((n): n is string => typeof n === "string") : [],
    tags: Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === "string") : [],
  };
}

/**
 * Convert parsed world info to stored format
 */
export function toStoredWorldInfoBook(
  name: string,
  book: WorldInfoBook,
  sourcePath?: string,
): StoredWorldInfoBook {
  const id = generateWorldInfoId(name);
  return {
    id,
    name,
    importedAt: new Date().toISOString(),
    sourcePath,
    enabled: true,
    entries: book.entries,
  };
}

/**
 * Generate a unique ID for a world info book
 */
function generateWorldInfoId(name: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 20);
  return `wi-${nameSlug}-${timestamp}-${random}`;
}

/**
 * Check if a world info entry should be activated based on the context
 */
export function checkEntryActivation(
  entry: WorldInfoEntry,
  context: string,
  config: WorldInfoConfig,
): ActivationResult {
  const uid = String(entry.uid);

  // Skip disabled entries
  if (entry.disable) {
    return { entry, uid, activated: false, matchedKeys: [] };
  }

  // Constant entries are always activated
  if (entry.constant) {
    return { entry, uid, activated: true, matchedKeys: ["[constant]"] };
  }

  // Check probability
  if (entry.useProbability && entry.probability < 100) {
    const roll = Math.random() * 100;
    if (roll > entry.probability) {
      return { entry, uid, activated: false, matchedKeys: [], probability: roll };
    }
  }

  // Determine case sensitivity (entry-level overrides config)
  const caseSensitive = entry.caseSensitive ?? false;
  const matchWholeWords = entry.matchWholeWords ?? false;

  // Prepare context for matching
  const searchContext = caseSensitive ? context : context.toLowerCase();

  // Check primary keys
  const matchedPrimaryKeys: string[] = [];
  for (const key of entry.key) {
    if (matchKey(key, searchContext, caseSensitive, matchWholeWords)) {
      matchedPrimaryKeys.push(key);
    }
  }

  // If no primary keys matched, entry is not activated
  if (matchedPrimaryKeys.length === 0) {
    return { entry, uid, activated: false, matchedKeys: [] };
  }

  // If selective mode is enabled, check secondary keys
  if (entry.selective && entry.keysecondary.length > 0) {
    const matchedSecondaryKeys: string[] = [];
    for (const key of entry.keysecondary) {
      if (matchKey(key, searchContext, caseSensitive, matchWholeWords)) {
        matchedSecondaryKeys.push(key);
      }
    }

    // Apply selective logic
    // 0 = AND_ANY (any primary AND any secondary)
    // 1 = NOT_ALL (any primary AND NOT all secondary)
    // 2 = NOT_ANY (any primary AND NOT any secondary)
    // 3 = AND_ALL (any primary AND all secondary)
    const selectiveLogic = entry.selectiveLogic ?? 0;

    let secondaryMatch = false;
    switch (selectiveLogic) {
      case 0: // AND_ANY
        secondaryMatch = matchedSecondaryKeys.length > 0;
        break;
      case 1: // NOT_ALL
        secondaryMatch = matchedSecondaryKeys.length < entry.keysecondary.length;
        break;
      case 2: // NOT_ANY
        secondaryMatch = matchedSecondaryKeys.length === 0;
        break;
      case 3: // AND_ALL
        secondaryMatch = matchedSecondaryKeys.length === entry.keysecondary.length;
        break;
      default:
        secondaryMatch = matchedSecondaryKeys.length > 0;
    }

    if (!secondaryMatch) {
      return { entry, uid, activated: false, matchedKeys: matchedPrimaryKeys };
    }

    return {
      entry,
      uid,
      activated: true,
      matchedKeys: [...matchedPrimaryKeys, ...matchedSecondaryKeys],
    };
  }

  // No selective mode, primary key match is sufficient
  return { entry, uid, activated: true, matchedKeys: matchedPrimaryKeys };
}

/**
 * Match a key against the context
 */
function matchKey(
  key: string,
  context: string,
  caseSensitive: boolean,
  matchWholeWords: boolean,
): boolean {
  const searchKey = caseSensitive ? key : key.toLowerCase();

  if (matchWholeWords) {
    // Use word boundary matching
    const regex = new RegExp(`\\b${escapeRegex(searchKey)}\\b`, caseSensitive ? "" : "i");
    return regex.test(context);
  }

  return context.includes(searchKey);
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Get activated entries from a world info book based on context
 */
export function getActivatedEntries(
  worldInfo: WorldInfoBook,
  context: string,
  config: WorldInfoConfig,
): ActivationResult[] {
  const results: ActivationResult[] = [];

  for (const [uid, entry] of Object.entries(worldInfo.entries)) {
    const result = checkEntryActivation(entry, context, config);
    if (result.activated) {
      results.push(result);
    }
  }

  // Sort by order (lower order = higher priority)
  results.sort((a, b) => (a.entry.order ?? 100) - (b.entry.order ?? 100));

  // Apply maxEntries limit if configured
  if (config.maxEntries && results.length > config.maxEntries) {
    return results.slice(0, config.maxEntries);
  }

  return results;
}

/**
 * Build the world info prompt from activated entries
 */
export function buildWorldInfoPrompt(
  activatedEntries: ActivationResult[],
  options?: {
    maxTokens?: number;
    separator?: string;
  },
): string {
  const separator = options?.separator ?? "\n\n";
  const parts: string[] = [];

  for (const result of activatedEntries) {
    if (result.entry.content) {
      parts.push(result.entry.content);
    }
  }

  return parts.join(separator);
}

/**
 * Get a summary of a world info book
 */
export function getWorldInfoSummary(stored: StoredWorldInfoBook): {
  name: string;
  entryCount: number;
  enabledCount: number;
  constantCount: number;
} {
  const entries = Object.values(stored.entries);
  const enabledCount = entries.filter((e) => !e.disable).length;
  const constantCount = entries.filter((e) => e.constant && !e.disable).length;

  return {
    name: stored.name,
    entryCount: entries.length,
    enabledCount,
    constantCount,
  };
}
