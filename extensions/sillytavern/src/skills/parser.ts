/**
 * Skill Parser
 * Parses SKILL.md files and extracts frontmatter and content
 */

import type {
  ParsedSkillFrontmatter,
  SkillMetadata,
  SkillInvocationPolicy,
  SkillEntry,
} from "./types.js";

/**
 * Parse YAML-like frontmatter from skill content
 */
export function parseFrontmatter(content: string): ParsedSkillFrontmatter {
  const frontmatter: ParsedSkillFrontmatter = {};

  // Match frontmatter block between --- markers
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) {
    return frontmatter;
  }

  const yamlContent = match[1];
  const lines = yamlContent.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Simple key: value parsing
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim();
      let value = trimmed.slice(colonIndex + 1).trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      frontmatter[key] = value;
    }
  }

  return frontmatter;
}

/**
 * Extract skill body content (after frontmatter)
 */
export function extractSkillBody(content: string): string {
  // Remove frontmatter block
  const withoutFrontmatter = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
  return withoutFrontmatter.trim();
}

/**
 * Parse metadata block from frontmatter
 * Supports nested YAML-like structure for openclaw metadata
 */
export function parseMetadataBlock(content: string): SkillMetadata | undefined {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) {
    return undefined;
  }

  const yamlContent = match[1];

  // Look for metadata block
  const metadataMatch = yamlContent.match(/metadata:\s*\n([\s\S]*?)(?=\n[a-z]|$)/i);
  if (!metadataMatch) {
    return undefined;
  }

  const metadata: SkillMetadata = {};
  const metadataContent = metadataMatch[1];

  // Parse openclaw metadata
  const openclawMatch = metadataContent.match(/openclaw:\s*\n([\s\S]*?)(?=\n\s{0,2}[a-z]|$)/i);
  if (openclawMatch) {
    const openclawContent = openclawMatch[1];

    // Parse emoji
    const emojiMatch = openclawContent.match(/emoji:\s*["']?([^"'\n]+)["']?/);
    if (emojiMatch) {
      metadata.emoji = emojiMatch[1].trim();
    }

    // Parse always
    const alwaysMatch = openclawContent.match(/always:\s*(true|false)/i);
    if (alwaysMatch) {
      metadata.always = alwaysMatch[1].toLowerCase() === "true";
    }

    // Parse skillKey
    const skillKeyMatch = openclawContent.match(/skillKey:\s*["']?([^"'\n]+)["']?/);
    if (skillKeyMatch) {
      metadata.skillKey = skillKeyMatch[1].trim();
    }

    // Parse primaryEnv
    const primaryEnvMatch = openclawContent.match(/primaryEnv:\s*["']?([^"'\n]+)["']?/);
    if (primaryEnvMatch) {
      metadata.primaryEnv = primaryEnvMatch[1].trim();
    }

    // Parse homepage
    const homepageMatch = openclawContent.match(/homepage:\s*["']?([^"'\n]+)["']?/);
    if (homepageMatch) {
      metadata.homepage = homepageMatch[1].trim();
    }

    // Parse requires block
    const requiresMatch = openclawContent.match(/requires:\s*\{([^}]+)\}/);
    if (requiresMatch) {
      const requiresContent = requiresMatch[1];
      metadata.requires = {};

      // Parse bins array
      const binsMatch = requiresContent.match(/bins:\s*\[([^\]]+)\]/);
      if (binsMatch) {
        metadata.requires.bins = binsMatch[1]
          .split(",")
          .map((s) => s.trim().replace(/["']/g, ""))
          .filter(Boolean);
      }

      // Parse anyBins array
      const anyBinsMatch = requiresContent.match(/anyBins:\s*\[([^\]]+)\]/);
      if (anyBinsMatch) {
        metadata.requires.anyBins = anyBinsMatch[1]
          .split(",")
          .map((s) => s.trim().replace(/["']/g, ""))
          .filter(Boolean);
      }

      // Parse env array
      const envMatch = requiresContent.match(/env:\s*\[([^\]]+)\]/);
      if (envMatch) {
        metadata.requires.env = envMatch[1]
          .split(",")
          .map((s) => s.trim().replace(/["']/g, ""))
          .filter(Boolean);
      }
    }
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Resolve skill invocation policy from frontmatter
 */
export function resolveSkillInvocationPolicy(
  frontmatter: ParsedSkillFrontmatter,
): SkillInvocationPolicy {
  const userInvocable = frontmatter.userInvocable !== "false";
  const disableModelInvocation = frontmatter.disableModelInvocation === "true";

  return {
    userInvocable,
    disableModelInvocation,
  };
}

/**
 * Parse a SKILL.md file content into a SkillEntry
 */
export function parseSkillFile(
  content: string,
  filePath: string,
  baseDir: string,
  source: SkillEntry["source"],
): SkillEntry {
  const frontmatter = parseFrontmatter(content);
  const body = extractSkillBody(content);
  const metadata = parseMetadataBlock(content);
  const invocation = resolveSkillInvocationPolicy(frontmatter);

  // Extract name from frontmatter or first heading
  let name = frontmatter.name || "";
  if (!name) {
    const headingMatch = body.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      name = headingMatch[1].trim();
    }
  }

  // Extract description from frontmatter or first paragraph
  let description = frontmatter.description || "";
  if (!description) {
    const paragraphMatch = body.match(/^(?!#)(.+)$/m);
    if (paragraphMatch) {
      description = paragraphMatch[1].trim().slice(0, 200);
    }
  }

  return {
    name,
    description,
    content: body,
    source,
    filePath,
    baseDir,
    frontmatter,
    metadata,
    invocation,
  };
}

/**
 * Build skill prompt from skill entries
 */
export function buildSkillsPrompt(
  skills: SkillEntry[],
  options?: {
    maxTokens?: number;
    separator?: string;
  },
): string {
  if (skills.length === 0) {
    return "";
  }

  const separator = options?.separator ?? "\n\n---\n\n";
  const maxTokens = options?.maxTokens ?? 4096;

  // Estimate tokens (rough: 4 chars per token)
  const maxChars = maxTokens * 4;

  const parts: string[] = [];
  let totalChars = 0;

  for (const skill of skills) {
    const skillPrompt = formatSkillForPrompt(skill);
    const skillChars = skillPrompt.length;

    if (totalChars + skillChars > maxChars) {
      break;
    }

    parts.push(skillPrompt);
    totalChars += skillChars + separator.length;
  }

  if (parts.length === 0) {
    return "";
  }

  return `# Available Skills\n\n${parts.join(separator)}`;
}

/**
 * Format a single skill for inclusion in prompt
 */
export function formatSkillForPrompt(skill: SkillEntry): string {
  const emoji = skill.metadata?.emoji ?? "🧩";
  const lines: string[] = [];

  lines.push(`## ${emoji} ${skill.name}`);

  if (skill.description) {
    lines.push("");
    lines.push(skill.description);
  }

  if (skill.content) {
    lines.push("");
    lines.push(skill.content);
  }

  return lines.join("\n");
}
