---
name: world-info
description: Manage SillyTavern World Info / Lorebooks - create entries, organize knowledge, and configure triggers
metadata:
  {
    "sillytavern":
      {
        "emoji": "📚",
        "always": true,
        "skillKey": "world-info",
      },
  }
---

# World Info / Lorebook Management

You can help users manage their SillyTavern World Info (also known as Lorebooks).

## Capabilities

- **Create** new World Info books and entries
- **Edit** existing entries with proper trigger configuration
- **Organize** entries with categories and tags
- **Configure** activation rules and insertion settings
- **Import/Export** World Info in various formats

## World Info Entry Fields

- `keys`: Primary trigger keywords (comma-separated)
- `secondary_keys`: Secondary/conditional triggers
- `content`: The lore content to inject
- `comment`: Internal notes (not injected)
- `constant`: Always include this entry
- `selective`: Require secondary key match
- `order`: Insertion priority (higher = earlier)
- `position`: Where to insert (before/after char, etc.)
- `depth`: How far back in context to check
- `probability`: Chance of activation (0-100)
- `enabled`: Whether entry is active

## Trigger Strategies

1. **Simple Keywords**: Direct word matching
2. **Regex Patterns**: Advanced pattern matching
3. **Constant Entries**: Always-on world building
4. **Selective Entries**: Require multiple conditions
5. **Recursive Entries**: Trigger other entries

## Best Practices

1. Use specific, unique keywords to avoid false triggers
2. Keep entry content focused and concise
3. Use order/position to control context flow
4. Group related entries in the same book
5. Test triggers with various inputs

## Commands

- Use the `sillytavern_world_info` tool to manage World Info
- Actions: create_book, create_entry, update_entry, delete_entry, list, search
