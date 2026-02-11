/**
 * SillyTavern Plugin for OpenClaw
 *
 * Provides support for SillyTavern character cards, world info (lorebooks),
 * and presets. This plugin allows users to import and use SillyTavern-format
 * content with OpenClaw.
 *
 * Features:
 * - Character Card V2/V3 import and activation
 * - World Info/Lorebook support with keyword-based activation
 * - Preset support with prompt entry management
 * - Skills support for learning and applying reusable instructions
 * - CLI commands for managing all content types
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { registerBootstrapHook } from "./src/hooks/bootstrap-hook.js";
import { registerSillyTavernCli } from "./src/cli/commands.js";
import { sillyTavernConfigSchema } from "./src/config-schema.js";
import { registerSkillsTool } from "./src/skills/tool.js";

const plugin = {
  id: "sillytavern",
  name: "SillyTavern",
  description: "SillyTavern character cards, world info, presets, and skills support",
  configSchema: sillyTavernConfigSchema(),

  register(api: OpenClawPluginApi) {
    api.logger.debug?.("[sillytavern] Registering SillyTavern plugin");

    // Register bootstrap hook for character card injection
    registerBootstrapHook(api);

    // Register skills tool for agent to create/manage skills
    registerSkillsTool(api);

    // Register CLI commands
    api.registerCli(
      ({ program }) => {
        registerSillyTavernCli(program);
      },
      { commands: ["sillytavern", "st"] },
    );

    api.logger.debug?.("[sillytavern] SillyTavern plugin registered");
  },
};

export default plugin;
