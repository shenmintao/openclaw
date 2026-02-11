/**
 * Skills Parser Tests
 */

import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  extractSkillBody,
  parseMetadataBlock,
  resolveSkillInvocationPolicy,
  parseSkillFile,
  buildSkillsPrompt,
  formatSkillForPrompt,
} from "./parser.js";
import type { SkillEntry } from "./types.js";

describe("parseFrontmatter", () => {
  it("parses simple key-value pairs", () => {
    const content = `---
name: test-skill
description: A test skill
---

# Test Skill`;

    const result = parseFrontmatter(content);
    expect(result.name).toBe("test-skill");
    expect(result.description).toBe("A test skill");
  });

  it("handles quoted values", () => {
    const content = `---
name: "quoted-name"
description: 'single quoted'
---`;

    const result = parseFrontmatter(content);
    expect(result.name).toBe("quoted-name");
    expect(result.description).toBe("single quoted");
  });

  it("returns empty object for content without frontmatter", () => {
    const content = "# Just a heading\n\nSome content";
    const result = parseFrontmatter(content);
    expect(result).toEqual({});
  });

  it("ignores comments in frontmatter", () => {
    const content = `---
name: test
# This is a comment
description: desc
---`;

    const result = parseFrontmatter(content);
    expect(result.name).toBe("test");
    expect(result.description).toBe("desc");
  });
});

describe("extractSkillBody", () => {
  it("extracts content after frontmatter", () => {
    const content = `---
name: test
---

# Skill Title

This is the body.`;

    const result = extractSkillBody(content);
    expect(result).toBe("# Skill Title\n\nThis is the body.");
  });

  it("returns full content if no frontmatter", () => {
    const content = "# No Frontmatter\n\nJust content.";
    const result = extractSkillBody(content);
    expect(result).toBe("# No Frontmatter\n\nJust content.");
  });
});

describe("parseMetadataBlock", () => {
  it("parses openclaw metadata", () => {
    const content = `---
name: test-skill
metadata:
  openclaw:
    emoji: "🔧"
    always: true
    skillKey: "test-key"
    primaryEnv: "TEST_API_KEY"
---`;

    const result = parseMetadataBlock(content);
    expect(result).toBeDefined();
    expect(result?.emoji).toBe("🔧");
    expect(result?.always).toBe(true);
    expect(result?.skillKey).toBe("test-key");
    expect(result?.primaryEnv).toBe("TEST_API_KEY");
  });

  it("returns undefined for content without metadata", () => {
    const content = `---
name: simple
---`;

    const result = parseMetadataBlock(content);
    expect(result).toBeUndefined();
  });
});

describe("resolveSkillInvocationPolicy", () => {
  it("returns default policy for empty frontmatter", () => {
    const result = resolveSkillInvocationPolicy({});
    expect(result.userInvocable).toBe(true);
    expect(result.disableModelInvocation).toBe(false);
  });

  it("respects userInvocable setting", () => {
    const result = resolveSkillInvocationPolicy({ userInvocable: "false" });
    expect(result.userInvocable).toBe(false);
  });

  it("respects disableModelInvocation setting", () => {
    const result = resolveSkillInvocationPolicy({ disableModelInvocation: "true" });
    expect(result.disableModelInvocation).toBe(true);
  });
});

describe("parseSkillFile", () => {
  it("parses a complete skill file", () => {
    const content = `---
name: weather
description: Get weather information
---

# Weather Skill

Use this skill to get weather information for a location.

## Usage

Call the weather API with a location name.`;

    const result = parseSkillFile(
      content,
      "/path/to/skills/weather/SKILL.md",
      "/path/to/skills/weather",
      "sillytavern-local",
    );

    expect(result.name).toBe("weather");
    expect(result.description).toBe("Get weather information");
    expect(result.source).toBe("sillytavern-local");
    expect(result.filePath).toBe("/path/to/skills/weather/SKILL.md");
    expect(result.baseDir).toBe("/path/to/skills/weather");
    expect(result.content).toContain("# Weather Skill");
  });

  it("extracts name from heading if not in frontmatter", () => {
    const content = `---
description: A skill
---

# My Skill Name

Content here.`;

    const result = parseSkillFile(content, "/path", "/base", "sillytavern-local");
    expect(result.name).toBe("My Skill Name");
  });
});

describe("formatSkillForPrompt", () => {
  it("formats skill with emoji and content", () => {
    const skill: SkillEntry = {
      name: "test-skill",
      description: "A test skill",
      content: "Use this skill for testing.",
      source: "sillytavern-local",
      filePath: "/path/SKILL.md",
      baseDir: "/path",
      frontmatter: {},
      metadata: { emoji: "🧪" },
    };

    const result = formatSkillForPrompt(skill);
    expect(result).toContain("## 🧪 test-skill");
    expect(result).toContain("A test skill");
    expect(result).toContain("Use this skill for testing.");
  });

  it("uses default emoji if not specified", () => {
    const skill: SkillEntry = {
      name: "no-emoji",
      description: "No emoji",
      content: "Content",
      source: "sillytavern-local",
      filePath: "/path/SKILL.md",
      baseDir: "/path",
      frontmatter: {},
    };

    const result = formatSkillForPrompt(skill);
    expect(result).toContain("## 🧩 no-emoji");
  });
});

describe("buildSkillsPrompt", () => {
  it("builds prompt from multiple skills", () => {
    const skills: SkillEntry[] = [
      {
        name: "skill-1",
        description: "First skill",
        content: "Content 1",
        source: "sillytavern-local",
        filePath: "/path/1/SKILL.md",
        baseDir: "/path/1",
        frontmatter: {},
        metadata: { emoji: "1️⃣" },
      },
      {
        name: "skill-2",
        description: "Second skill",
        content: "Content 2",
        source: "sillytavern-local",
        filePath: "/path/2/SKILL.md",
        baseDir: "/path/2",
        frontmatter: {},
        metadata: { emoji: "2️⃣" },
      },
    ];

    const result = buildSkillsPrompt(skills);
    expect(result).toContain("# Available Skills");
    expect(result).toContain("## 1️⃣ skill-1");
    expect(result).toContain("## 2️⃣ skill-2");
    expect(result).toContain("Content 1");
    expect(result).toContain("Content 2");
  });

  it("returns empty string for empty skills array", () => {
    const result = buildSkillsPrompt([]);
    expect(result).toBe("");
  });

  it("respects maxTokens limit", () => {
    const longContent = "x".repeat(10000);
    const skills: SkillEntry[] = [
      {
        name: "long-skill",
        description: "Long",
        content: longContent,
        source: "sillytavern-local",
        filePath: "/path/SKILL.md",
        baseDir: "/path",
        frontmatter: {},
      },
    ];

    // With very low maxTokens, should truncate
    const result = buildSkillsPrompt(skills, { maxTokens: 100 });
    // Should either be empty or truncated
    expect(result.length).toBeLessThan(longContent.length);
  });
});
