/**
 * Character Card Parser
 * Parses SillyTavern character card files (V2/V3 JSON format)
 */

import type {
  CharacterCard,
  CharacterCardData,
  CharacterCardV2,
  CharacterCardV3,
  StoredCharacterCard,
} from "../types.js";

/**
 * Validation result for character card parsing
 */
export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Check if the object is a valid CharacterCardV2
 */
function isCharacterCardV2(obj: unknown): obj is CharacterCardV2 {
  if (!obj || typeof obj !== "object") return false;
  const card = obj as Record<string, unknown>;
  return (
    card.spec === "chara_card_v2" &&
    card.spec_version === "2.0" &&
    typeof card.data === "object" &&
    card.data !== null
  );
}

/**
 * Check if the object is a valid CharacterCardV3
 */
function isCharacterCardV3(obj: unknown): obj is CharacterCardV3 {
  if (!obj || typeof obj !== "object") return false;
  const card = obj as Record<string, unknown>;
  return (
    card.spec === "chara_card_v3" &&
    card.spec_version === "3.0" &&
    typeof card.data === "object" &&
    card.data !== null
  );
}

/**
 * Validate character card data fields
 */
function validateCharacterData(data: unknown): ParseResult<CharacterCardData> {
  if (!data || typeof data !== "object") {
    return { success: false, error: "Character data is not an object" };
  }

  const d = data as Record<string, unknown>;

  // Required field: name
  if (typeof d.name !== "string" || !d.name.trim()) {
    return { success: false, error: "Character name is required" };
  }

  // Build validated data with defaults
  const validated: CharacterCardData = {
    name: d.name.trim(),
    description: typeof d.description === "string" ? d.description : "",
    personality: typeof d.personality === "string" ? d.personality : "",
    scenario: typeof d.scenario === "string" ? d.scenario : "",
    first_mes: typeof d.first_mes === "string" ? d.first_mes : "",
    mes_example: typeof d.mes_example === "string" ? d.mes_example : "",
    creator_notes: typeof d.creator_notes === "string" ? d.creator_notes : "",
    system_prompt: typeof d.system_prompt === "string" ? d.system_prompt : "",
    post_history_instructions:
      typeof d.post_history_instructions === "string" ? d.post_history_instructions : "",
    alternate_greetings: Array.isArray(d.alternate_greetings)
      ? d.alternate_greetings.filter((g): g is string => typeof g === "string")
      : [],
    tags: Array.isArray(d.tags) ? d.tags.filter((t): t is string => typeof t === "string") : [],
    creator: typeof d.creator === "string" ? d.creator : "",
    character_version: typeof d.character_version === "string" ? d.character_version : "",
    character_book:
      d.character_book && typeof d.character_book === "object"
        ? (d.character_book as CharacterCardData["character_book"])
        : undefined,
    extensions:
      d.extensions && typeof d.extensions === "object"
        ? (d.extensions as CharacterCardData["extensions"])
        : {},
  };

  return { success: true, data: validated };
}

/**
 * Parse a character card from JSON string
 */
export function parseCharacterCardJson(jsonString: string): ParseResult<CharacterCard> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    return { success: false, error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }

  return parseCharacterCardObject(parsed);
}

/**
 * Parse a character card from a parsed object
 */
export function parseCharacterCardObject(obj: unknown): ParseResult<CharacterCard> {
  if (!obj || typeof obj !== "object") {
    return { success: false, error: "Input is not an object" };
  }

  // Try V3 first
  if (isCharacterCardV3(obj)) {
    const dataResult = validateCharacterData(obj.data);
    if (!dataResult.success) {
      return { success: false, error: dataResult.error };
    }
    return {
      success: true,
      data: {
        ...obj,
        data: dataResult.data!,
      } as CharacterCardV3,
    };
  }

  // Try V2
  if (isCharacterCardV2(obj)) {
    const dataResult = validateCharacterData(obj.data);
    if (!dataResult.success) {
      return { success: false, error: dataResult.error };
    }
    return {
      success: true,
      data: {
        ...obj,
        data: dataResult.data!,
      } as CharacterCardV2,
    };
  }

  // Check if it might be a legacy format (no spec field but has data)
  const record = obj as Record<string, unknown>;
  if (record.data && typeof record.data === "object") {
    const dataResult = validateCharacterData(record.data);
    if (dataResult.success) {
      // Treat as V2
      return {
        success: true,
        data: {
          spec: "chara_card_v2",
          spec_version: "2.0",
          data: dataResult.data!,
        } as CharacterCardV2,
      };
    }
  }

  // Check if it's a flat structure (V1-like)
  if (typeof record.name === "string" && record.name.trim()) {
    const dataResult = validateCharacterData(record);
    if (dataResult.success) {
      return {
        success: true,
        data: {
          spec: "chara_card_v2",
          spec_version: "2.0",
          data: dataResult.data!,
        } as CharacterCardV2,
      };
    }
  }

  return {
    success: false,
    error: "Unknown character card format. Expected chara_card_v2 or chara_card_v3.",
  };
}

/**
 * Generate a unique ID for a character card
 */
export function generateCharacterId(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const timestamp = Date.now().toString(36);
  return `${sanitized}-${timestamp}`;
}

/**
 * Convert a parsed character card to stored format
 */
export function toStoredCharacterCard(
  card: CharacterCard,
  sourcePath?: string,
): StoredCharacterCard {
  const id = generateCharacterId(card.data.name);
  return {
    id,
    name: card.data.name,
    spec: card.spec,
    importedAt: new Date().toISOString(),
    sourcePath,
    data: card.data,
  };
}

/**
 * Build a prompt from character card data
 */
export function buildCharacterPrompt(
  data: CharacterCardData,
  options: {
    includeSystemPrompt?: boolean;
    includeDescription?: boolean;
    includePersonality?: boolean;
    includeScenario?: boolean;
    includeExamples?: boolean;
    includePostHistory?: boolean;
  } = {},
): string {
  const {
    includeSystemPrompt = true,
    includeDescription = true,
    includePersonality = true,
    includeScenario = true,
    includeExamples = true,
    includePostHistory = false,
  } = options;

  const sections: string[] = [];

  // Character name header
  sections.push(`# Character: ${data.name}`);

  // System prompt (core instructions)
  if (includeSystemPrompt && data.system_prompt.trim()) {
    sections.push("");
    sections.push("## System Instructions");
    sections.push(data.system_prompt.trim());
  }

  // Description (appearance, background)
  if (includeDescription && data.description.trim()) {
    sections.push("");
    sections.push("## Description");
    sections.push(data.description.trim());
  }

  // Personality
  if (includePersonality && data.personality.trim()) {
    sections.push("");
    sections.push("## Personality");
    sections.push(data.personality.trim());
  }

  // Scenario
  if (includeScenario && data.scenario.trim()) {
    sections.push("");
    sections.push("## Scenario");
    sections.push(data.scenario.trim());
  }

  // Dialogue examples
  if (includeExamples && data.mes_example.trim()) {
    sections.push("");
    sections.push("## Example Dialogue");
    sections.push(data.mes_example.trim());
  }

  // Post-history instructions (jailbreak)
  if (includePostHistory && data.post_history_instructions.trim()) {
    sections.push("");
    sections.push("## Additional Instructions");
    sections.push(data.post_history_instructions.trim());
  }

  return sections.join("\n");
}

/**
 * Get a summary of a character card for display
 */
export function getCharacterSummary(card: StoredCharacterCard): {
  name: string;
  spec: string;
  tags: string[];
  creator: string;
  hasSystemPrompt: boolean;
  hasWorldBook: boolean;
  descriptionPreview: string;
} {
  const data = card.data;
  return {
    name: data.name,
    spec: card.spec,
    tags: data.tags,
    creator: data.creator,
    hasSystemPrompt: !!data.system_prompt.trim(),
    hasWorldBook: !!data.character_book?.entries?.length,
    descriptionPreview:
      data.description.length > 100 ? data.description.slice(0, 100) + "..." : data.description,
  };
}
