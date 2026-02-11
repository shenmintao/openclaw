/**
 * Character Card Parser Tests
 */

import { describe, it, expect } from "vitest";
import {
  parseCharacterCardJson,
  buildCharacterPrompt,
  getCharacterSummary,
  toStoredCharacterCard,
} from "./character-card.js";
import type { CharacterCardData } from "../types.js";

// Sample V3 character card (based on real format)
const sampleV3Card = {
  spec: "chara_card_v3",
  spec_version: "3.0",
  data: {
    name: "测试角色",
    description: "这是一个测试角色的描述",
    personality: "友善、乐于助人",
    scenario: "在一个虚拟世界中",
    first_mes: "你好！我是测试角色。",
    mes_example: "<START>\\n{{user}}: 你好\\n{{char}}: 你好！很高兴见到你！",
    creator_notes: "这是创作者备注",
    system_prompt: "你是一个友善的助手",
    post_history_instructions: "保持角色一致性",
    tags: ["测试", "示例"],
    creator: "测试创作者",
    character_version: "1.0",
    alternate_greetings: ["另一个问候语"],
    extensions: {
      depth_prompt: {
        prompt: "深度提示内容",
        depth: 4,
        role: "system",
      },
    },
    character_book: {
      extensions: {},
      entries: [
        {
          keys: ["关键词1", "关键词2"],
          content: "这是世界书条目内容",
          enabled: true,
          insertion_order: 100,
          extensions: {},
          name: "测试条目",
        },
      ],
    },
  },
  tags: ["外层标签"],
};

// Sample V2 character card
const sampleV2Card = {
  spec: "chara_card_v2",
  spec_version: "2.0",
  data: {
    name: "V2角色",
    description: "V2格式的角色描述",
    personality: "活泼开朗",
    scenario: "",
    first_mes: "嗨！",
    mes_example: "",
    creator_notes: "",
    system_prompt: "",
    post_history_instructions: "",
    tags: [],
    creator: "",
    character_version: "",
    alternate_greetings: [],
    extensions: {},
  },
};

describe("parseCharacterCardJson", () => {
  it("should parse a valid V3 character card", () => {
    const result = parseCharacterCardJson(JSON.stringify(sampleV3Card));

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.spec).toBe("chara_card_v3");
    expect(result.data!.data.name).toBe("测试角色");
    expect(result.data!.data.tags).toContain("测试");
  });

  it("should parse a valid V2 character card", () => {
    const result = parseCharacterCardJson(JSON.stringify(sampleV2Card));

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.spec).toBe("chara_card_v2");
    expect(result.data!.data.name).toBe("V2角色");
  });

  it("should fail on invalid JSON", () => {
    const result = parseCharacterCardJson("not valid json");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid JSON");
  });

  it("should handle legacy format without spec field", () => {
    // Legacy format: has data with name but no spec field
    // Parser should treat this as V2 for backward compatibility
    const legacyCard = { data: { name: "Test" } };
    const result = parseCharacterCardJson(JSON.stringify(legacyCard));

    expect(result.success).toBe(true);
    expect(result.data?.spec).toBe("chara_card_v2");
    expect(result.data?.data.name).toBe("Test");
  });

  it("should handle V1-like flat structure", () => {
    // V1-like format: name at top level (flat structure)
    // Parser should treat this as V2 for backward compatibility
    const v1Card = { name: "Test", description: "A test character" };
    const result = parseCharacterCardJson(JSON.stringify(v1Card));

    expect(result.success).toBe(true);
    expect(result.data?.spec).toBe("chara_card_v2");
    expect(result.data?.data.name).toBe("Test");
  });

  it("should fail on completely invalid structure", () => {
    // No name field anywhere - truly invalid
    const invalidCard = { foo: "bar", baz: 123 };
    const result = parseCharacterCardJson(JSON.stringify(invalidCard));

    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown character card format");
  });

  it("should fail on missing name field", () => {
    // Valid V2 structure but missing name in data
    const invalidCard = { spec: "chara_card_v2", spec_version: "2.0", data: {} };
    const result = parseCharacterCardJson(JSON.stringify(invalidCard));

    expect(result.success).toBe(false);
    expect(result.error).toContain("name");
  });
});

describe("buildCharacterPrompt", () => {
  it("should build a complete prompt with all sections", () => {
    const parseResult = parseCharacterCardJson(JSON.stringify(sampleV3Card));
    expect(parseResult.success).toBe(true);
    const cardData = parseResult.data!.data;

    const prompt = buildCharacterPrompt(cardData, {
      includeSystemPrompt: true,
      includeDescription: true,
      includePersonality: true,
      includeScenario: true,
      includeExamples: true,
      includePostHistory: true,
    });

    expect(prompt).toContain("测试角色");
    expect(prompt).toContain("这是一个测试角色的描述");
    expect(prompt).toContain("友善、乐于助人");
    expect(prompt).toContain("在一个虚拟世界中");
    expect(prompt).toContain("你是一个友善的助手");
  });

  it("should exclude sections when options are false", () => {
    const parseResult = parseCharacterCardJson(JSON.stringify(sampleV3Card));
    expect(parseResult.success).toBe(true);
    const cardData = parseResult.data!.data;

    const prompt = buildCharacterPrompt(cardData, {
      includeSystemPrompt: false,
      includeDescription: true,
      includePersonality: false,
      includeScenario: false,
      includeExamples: false,
      includePostHistory: false,
    });

    expect(prompt).toContain("测试角色");
    expect(prompt).toContain("这是一个测试角色的描述");
    expect(prompt).not.toContain("友善、乐于助人");
    expect(prompt).not.toContain("在一个虚拟世界中");
  });

  it("should handle empty fields gracefully", () => {
    const parseResult = parseCharacterCardJson(JSON.stringify(sampleV2Card));
    expect(parseResult.success).toBe(true);
    const cardData = parseResult.data!.data;

    const prompt = buildCharacterPrompt(cardData, {
      includeSystemPrompt: true,
      includeDescription: true,
      includePersonality: true,
      includeScenario: true,
      includeExamples: true,
      includePostHistory: true,
    });

    expect(prompt).toContain("V2角色");
    expect(prompt).toContain("V2格式的角色描述");
    // Should not contain empty section headers
    expect(prompt).not.toContain("Scenario:");
  });
});

describe("getCharacterSummary", () => {
  it("should return correct summary for V3 card", () => {
    const parseResult = parseCharacterCardJson(JSON.stringify(sampleV3Card));
    expect(parseResult.success).toBe(true);

    const stored = toStoredCharacterCard(parseResult.data!, "test.json");
    const summary = getCharacterSummary(stored);

    expect(summary.name).toBe("测试角色");
    expect(summary.spec).toBe("chara_card_v3");
    expect(summary.creator).toBe("测试创作者");
    expect(summary.tags).toContain("测试");
    expect(summary.hasSystemPrompt).toBe(true);
    expect(summary.hasWorldBook).toBe(true);
  });

  it("should return correct summary for V2 card without world book", () => {
    const parseResult = parseCharacterCardJson(JSON.stringify(sampleV2Card));
    expect(parseResult.success).toBe(true);

    const stored = toStoredCharacterCard(parseResult.data!, "test.json");
    const summary = getCharacterSummary(stored);

    expect(summary.name).toBe("V2角色");
    expect(summary.spec).toBe("chara_card_v2");
    expect(summary.hasSystemPrompt).toBe(false);
    expect(summary.hasWorldBook).toBe(false);
  });
});

describe("toStoredCharacterCard", () => {
  it("should create a stored card with ID and metadata", () => {
    const parseResult = parseCharacterCardJson(JSON.stringify(sampleV3Card));
    expect(parseResult.success).toBe(true);

    const stored = toStoredCharacterCard(parseResult.data!, "/path/to/card.json");

    expect(stored.id).toBeDefined();
    expect(stored.id.length).toBeGreaterThan(0);
    expect(stored.name).toBe("测试角色");
    expect(stored.spec).toBe("chara_card_v3");
    expect(stored.sourcePath).toBe("/path/to/card.json");
    expect(stored.importedAt).toBeDefined();
    expect(stored.data.name).toBe("测试角色");
  });

  it("should generate unique IDs for different cards", () => {
    const parseResult1 = parseCharacterCardJson(JSON.stringify(sampleV3Card));
    const parseResult2 = parseCharacterCardJson(JSON.stringify(sampleV2Card));

    const stored1 = toStoredCharacterCard(parseResult1.data!, "card1.json");
    const stored2 = toStoredCharacterCard(parseResult2.data!, "card2.json");

    expect(stored1.id).not.toBe(stored2.id);
  });
});
