---
name: character-card
description: Manage SillyTavern character cards - create, edit, import, export, and analyze character definitions
metadata:
  {
    "sillytavern":
      {
        "emoji": "🎭",
        "always": true,
        "skillKey": "character-card",
      },
  }
---

# Character Card Management

You can help users manage their SillyTavern character cards.

## Capabilities

- **Create** new character cards with proper V2 spec format
- **Edit** existing character card fields (name, description, personality, scenario, etc.)
- **Import** character cards from PNG files or JSON
- **Export** character cards to PNG or JSON format
- **Analyze** character cards for quality and completeness

## Character Card V2 Spec Fields

- `name`: Character's display name
- `description`: Physical appearance and background
- `personality`: Personality traits and behaviors
- `scenario`: The current situation or setting
- `first_mes`: The character's opening message
- `mes_example`: Example dialogue exchanges
- `creator_notes`: Notes from the card creator
- `system_prompt`: Custom system prompt override
- `post_history_instructions`: Instructions added after chat history
- `tags`: Array of categorization tags
- `creator`: Card creator's name
- `character_version`: Version string

## Best Practices

1. Keep descriptions concise but evocative
2. Use specific personality traits rather than vague ones
3. Include example dialogues that showcase the character's voice
4. Set appropriate scenario context
5. Use tags for easy organization

## Commands

- Use the `sillytavern_character` tool to manage characters
- Actions: create, update, delete, list, get, import, export
