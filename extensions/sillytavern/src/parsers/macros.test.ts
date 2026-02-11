/**
 * Macro substitution tests
 */

import { describe, it, expect } from "vitest";
import { applyMacros, getDefaultMacros } from "./preset.js";

describe("applyMacros", () => {
  it("should replace standard macros", () => {
    const content = "Hello {{user}}, I am {{char}}!";
    const macros = { user: "Alice", char: "Bob" };
    const result = applyMacros(content, macros);
    expect(result).toBe("Hello Alice, I am Bob!");
  });

  it("should be case-insensitive", () => {
    const content = "{{USER}} and {{User}} and {{user}}";
    const macros = { user: "Test" };
    const result = applyMacros(content, macros);
    expect(result).toBe("Test and Test and Test");
  });

  it("should handle multiple occurrences", () => {
    const content = "{{char}} says: Hello! {{char}} is happy.";
    const macros = { char: "Assistant" };
    const result = applyMacros(content, macros);
    expect(result).toBe("Assistant says: Hello! Assistant is happy.");
  });

  it("should handle custom variables with {{custom::key}} syntax", () => {
    const content = "My favorite color is {{custom::color}} and I like {{custom::food}}.";
    const macros = { user: "User" };
    const customVariables = { color: "blue", food: "pizza" };
    const result = applyMacros(content, macros, customVariables);
    expect(result).toBe("My favorite color is blue and I like pizza.");
  });

  it("should handle mixed standard and custom macros", () => {
    const content = "{{user}} likes {{custom::hobby}} and talks to {{char}}.";
    const macros = { user: "Alice", char: "Bob" };
    const customVariables = { hobby: "reading" };
    const result = applyMacros(content, macros, customVariables);
    expect(result).toBe("Alice likes reading and talks to Bob.");
  });

  it("should leave unmatched macros unchanged", () => {
    const content = "Hello {{user}}, {{unknown}} is here.";
    const macros = { user: "Alice" };
    const result = applyMacros(content, macros);
    expect(result).toBe("Hello Alice, {{unknown}} is here.");
  });

  it("should handle empty content", () => {
    const result = applyMacros("", { user: "Test" });
    expect(result).toBe("");
  });

  it("should handle content without macros", () => {
    const content = "No macros here!";
    const result = applyMacros(content, { user: "Test" });
    expect(result).toBe("No macros here!");
  });
});

describe("getDefaultMacros", () => {
  it("should return default values when no options provided", () => {
    const macros = getDefaultMacros();
    expect(macros.user).toBe("User");
    expect(macros.char).toBe("Assistant");
    expect(macros.persona).toBe("");
    expect(macros.newline).toBe("\n");
    expect(macros.tab).toBe("\t");
  });

  it("should use provided user and char names", () => {
    const macros = getDefaultMacros({ user: "Alice", char: "Bob" });
    expect(macros.user).toBe("Alice");
    expect(macros.char).toBe("Bob");
  });

  it("should format date according to dateFormat", () => {
    const macros = getDefaultMacros({ dateFormat: "YYYY-MM-DD" });
    // Date format should match YYYY-MM-DD pattern
    expect(macros.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should format time according to timeFormat", () => {
    const macros = getDefaultMacros({ timeFormat: "HH:mm" });
    // Time format should match HH:mm pattern
    expect(macros.time).toMatch(/^\d{2}:\d{2}$/);
  });

  it("should use idleDuration when provided", () => {
    const macros = getDefaultMacros({ idleDuration: 30 });
    expect(macros.idle_duration).toBe("30");
  });

  it("should generate reproducible random with seed", () => {
    const macros1 = getDefaultMacros({ randomSeed: 42 });
    const macros2 = getDefaultMacros({ randomSeed: 42 });
    expect(macros1.random).toBe(macros2.random);
  });

  it("should generate different random values with different seeds", () => {
    const macros1 = getDefaultMacros({ randomSeed: 42 });
    const macros2 = getDefaultMacros({ randomSeed: 123 });
    // Different seeds should produce different values (with high probability)
    // Note: This could theoretically fail if two seeds happen to produce the same value
    expect(macros1.random).not.toBe(macros2.random);
  });

  it("should include weekday, month, and year macros", () => {
    const macros = getDefaultMacros();
    expect(macros.weekday).toBeTruthy();
    expect(macros.month).toBeTruthy();
    expect(macros.year).toMatch(/^\d{4}$/);
  });
});

describe("macro integration", () => {
  it("should work with SillyTavern-style preset content", () => {
    const presetContent = `You are {{char}}, talking to {{user}}.
Current date: {{date}}
Current time: {{time}}

{{char}}'s personality: friendly and helpful.
{{user}} is your friend.`;

    const macros = getDefaultMacros({
      user: "小明",
      char: "小猫之神",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "HH:mm",
    });

    const result = applyMacros(presetContent, macros);

    expect(result).toContain("You are 小猫之神, talking to 小明.");
    expect(result).toContain("小猫之神's personality: friendly and helpful.");
    expect(result).toContain("小明 is your friend.");
    expect(result).toMatch(/Current date: \d{4}-\d{2}-\d{2}/);
    expect(result).toMatch(/Current time: \d{2}:\d{2}/);
  });

  it("should work with custom variables for roleplay scenarios", () => {
    const content = `{{char}} lives in {{custom::location}}.
{{char}}'s occupation is {{custom::occupation}}.
{{user}} met {{char}} at {{custom::meeting_place}}.`;

    const macros = getDefaultMacros({ user: "玩家", char: "NPC角色" });
    const customVariables = {
      location: "东京",
      occupation: "侦探",
      meeting_place: "咖啡馆",
    };

    const result = applyMacros(content, macros, customVariables);

    expect(result).toBe(`NPC角色 lives in 东京.
NPC角色's occupation is 侦探.
玩家 met NPC角色 at 咖啡馆.`);
  });
});
