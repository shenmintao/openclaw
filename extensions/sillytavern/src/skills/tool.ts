/**
 * Skills Tool for SillyTavern Plugin
 *
 * Provides agent tools for creating, updating, and managing skills.
 * This allows the character to learn new skills through conversation.
 */

import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import {
  importSkill,
  getAllSkills,
  setSkillEnabled,
  removeSkill,
  loadStoredSkill,
  saveStoredSkill,
  loadSkillsIndex,
} from "./store.js";
import { parseFrontmatter, extractSkillBody } from "./parser.js";
import type { StoredSkill } from "./types.js";
import * as fs from "node:fs";
import * as path from "node:path";

const fsp = fs.promises;

/**
 * Get the skills storage directory
 */
function getSkillsStorageDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || ".";
  return path.join(homeDir, ".sillytavern", "skills", "skills-data");
}

/**
 * Generate a skill filename from the skill name
 */
function generateSkillFilename(name: string): string {
  // Convert to lowercase, replace spaces with hyphens, remove special chars
  const sanitized = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 50);
  return `${sanitized}.md`;
}

/**
 * Create a SKILL.md file content from parameters
 */
function createSkillContent(params: {
  name: string;
  description: string;
  instructions: string;
  tags?: string[];
  globs?: string[];
}): string {
  const frontmatter: string[] = ["---"];
  frontmatter.push(`name: ${params.name}`);
  frontmatter.push(`description: ${params.description}`);

  if (params.tags && params.tags.length > 0) {
    frontmatter.push(`tags: [${params.tags.map((t) => `"${t}"`).join(", ")}]`);
  }

  if (params.globs && params.globs.length > 0) {
    frontmatter.push(`globs: [${params.globs.map((g) => `"${g}"`).join(", ")}]`);
  }

  frontmatter.push("---");
  frontmatter.push("");
  frontmatter.push(params.instructions);

  return frontmatter.join("\n");
}

/**
 * Tool schema for skill management
 */
const SkillToolSchema = Type.Object({
  action: Type.Union([
    Type.Literal("create"),
    Type.Literal("update"),
    Type.Literal("delete"),
    Type.Literal("list"),
    Type.Literal("get"),
    Type.Literal("enable"),
    Type.Literal("disable"),
  ]),
  name: Type.Optional(
    Type.String({
      description: "Skill name (required for create/update/delete/get/enable/disable)",
    }),
  ),
  description: Type.Optional(
    Type.String({ description: "Skill description (required for create, optional for update)" }),
  ),
  instructions: Type.Optional(
    Type.String({
      description: "Skill instructions/content (required for create, optional for update)",
    }),
  ),
  tags: Type.Optional(
    Type.Array(Type.String(), { description: "Optional tags for categorization" }),
  ),
  globs: Type.Optional(
    Type.Array(Type.String(), {
      description: "Optional file glob patterns for skill applicability",
    }),
  ),
});

/**
 * Register the skills tool with the plugin API
 */
export function registerSkillsTool(api: OpenClawPluginApi): void {
  api.registerTool({
    name: "sillytavern_skill",
    label: "SillyTavern Skill Manager",
    description:
      "Create, update, delete, and manage skills. Skills are reusable instructions that can be learned and applied in future conversations.",
    parameters: SkillToolSchema,
    async execute(_toolCallId, params) {
      const json = (payload: unknown) => ({
        content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
        details: payload,
      });

      try {
        const action = params?.action;

        switch (action) {
          case "create": {
            const name = String(params.name || "").trim();
            const description = String(params.description || "").trim();
            const instructions = String(params.instructions || "").trim();

            if (!name) {
              throw new Error("name is required for creating a skill");
            }
            if (!description) {
              throw new Error("description is required for creating a skill");
            }
            if (!instructions) {
              throw new Error("instructions are required for creating a skill");
            }

            // Check if skill already exists
            const existingSkills = await getAllSkills();
            const existing = existingSkills.find(
              (s) => s.name.toLowerCase() === name.toLowerCase(),
            );
            if (existing) {
              throw new Error(`Skill "${name}" already exists. Use 'update' action to modify it.`);
            }

            // Create skill content
            const tags = Array.isArray(params.tags) ? params.tags.map(String) : [];
            const globs = Array.isArray(params.globs) ? params.globs.map(String) : [];
            const content = createSkillContent({ name, description, instructions, tags, globs });

            // Write to file
            const storageDir = getSkillsStorageDir();
            await fsp.mkdir(storageDir, { recursive: true });

            const filename = generateSkillFilename(name);
            const filepath = path.join(storageDir, filename);
            await fsp.writeFile(filepath, content, "utf-8");

            // Import the skill
            const skill = await importSkill(filepath);

            return json({
              success: true,
              action: "created",
              skill: {
                id: skill.id,
                name: skill.name,
                description: skill.description,
                enabled: skill.enabled,
              },
            });
          }

          case "update": {
            const name = String(params.name || "").trim();
            if (!name) {
              throw new Error("name is required for updating a skill");
            }

            // Find existing skill
            const existingSkills = await getAllSkills();
            const existing = existingSkills.find(
              (s) => s.name.toLowerCase() === name.toLowerCase(),
            );
            if (!existing) {
              throw new Error(`Skill "${name}" not found. Use 'create' action to create it.`);
            }

            // Read existing content
            const existingContent = await fsp.readFile(existing.filePath, "utf-8");
            const frontmatter = parseFrontmatter(existingContent);
            const body = extractSkillBody(existingContent);

            // Update fields
            const newDescription =
              params.description !== undefined
                ? String(params.description).trim()
                : frontmatter.description || existing.description;
            const newInstructions =
              params.instructions !== undefined ? String(params.instructions).trim() : body;

            // Parse existing tags/globs from frontmatter
            const existingTags = frontmatter.tags
              ? frontmatter.tags
                  .replace(/[\[\]]/g, "")
                  .split(",")
                  .map((s) => s.trim().replace(/["']/g, ""))
                  .filter(Boolean)
              : [];
            const existingGlobs = frontmatter.globs
              ? frontmatter.globs
                  .replace(/[\[\]]/g, "")
                  .split(",")
                  .map((s) => s.trim().replace(/["']/g, ""))
                  .filter(Boolean)
              : [];

            const newTags = Array.isArray(params.tags) ? params.tags.map(String) : existingTags;
            const newGlobs = Array.isArray(params.globs) ? params.globs.map(String) : existingGlobs;

            // Create updated content
            const content = createSkillContent({
              name: existing.name,
              description: newDescription,
              instructions: newInstructions,
              tags: newTags,
              globs: newGlobs,
            });

            // Write back
            await fsp.writeFile(existing.filePath, content, "utf-8");

            // Update stored skill
            existing.description = newDescription;
            existing.content = newInstructions;
            await saveStoredSkill(existing);

            return json({
              success: true,
              action: "updated",
              skill: {
                id: existing.id,
                name: existing.name,
                description: existing.description,
                enabled: existing.enabled,
              },
            });
          }

          case "delete": {
            const name = String(params.name || "").trim();
            if (!name) {
              throw new Error("name is required for deleting a skill");
            }

            // Find existing skill
            const existingSkills = await getAllSkills();
            const existing = existingSkills.find(
              (s) => s.name.toLowerCase() === name.toLowerCase(),
            );
            if (!existing) {
              throw new Error(`Skill "${name}" not found.`);
            }

            // Remove from store
            await removeSkill(existing.id);

            // Delete file if exists
            try {
              await fsp.unlink(existing.filePath);
            } catch {
              // Ignore if file doesn't exist
            }

            return json({
              success: true,
              action: "deleted",
              name: existing.name,
            });
          }

          case "list": {
            const skills = await getAllSkills();
            return json({
              success: true,
              count: skills.length,
              skills: skills.map((s) => ({
                id: s.id,
                name: s.name,
                description: s.description,
                enabled: s.enabled,
              })),
            });
          }

          case "get": {
            const name = String(params.name || "").trim();
            if (!name) {
              throw new Error("name is required for getting a skill");
            }

            const skills = await getAllSkills();
            const skill = skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
            if (!skill) {
              throw new Error(`Skill "${name}" not found.`);
            }

            return json({
              success: true,
              skill: {
                id: skill.id,
                name: skill.name,
                description: skill.description,
                enabled: skill.enabled,
                content: skill.content,
                filePath: skill.filePath,
                importedAt: skill.importedAt,
              },
            });
          }

          case "enable": {
            const name = String(params.name || "").trim();
            if (!name) {
              throw new Error("name is required for enabling a skill");
            }

            // Find skill by name
            const skills = await getAllSkills();
            const skill = skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
            if (!skill) {
              throw new Error(`Skill "${name}" not found.`);
            }

            await setSkillEnabled(skill.id, true);

            return json({
              success: true,
              action: "enabled",
              name: skill.name,
            });
          }

          case "disable": {
            const name = String(params.name || "").trim();
            if (!name) {
              throw new Error("name is required for disabling a skill");
            }

            // Find skill by name
            const skills = await getAllSkills();
            const skill = skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
            if (!skill) {
              throw new Error(`Skill "${name}" not found.`);
            }

            await setSkillEnabled(skill.id, false);

            return json({
              success: true,
              action: "disabled",
              name: skill.name,
            });
          }

          default:
            throw new Error(
              `Unknown action: ${action}. Valid actions: create, update, delete, list, get, enable, disable`,
            );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ success: false, error: message });
      }
    },
  });
}
