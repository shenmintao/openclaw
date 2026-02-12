---
name: memory-management
description: Manage conversation memory and context - summarization, key facts extraction, and memory optimization
metadata:
  {
    "sillytavern":
      {
        "emoji": "🧠",
        "skillKey": "memory-management",
      },
  }
---

# Memory Management

You can help users manage conversation memory and context in SillyTavern.

## Capabilities

- **Summarization**: Create concise conversation summaries
- **Key Facts Extraction**: Identify and store important information
- **Memory Optimization**: Manage context window efficiently
- **Memory Search**: Find relevant past information
- **Memory Editing**: Update or correct stored memories

## Memory Types

### Short-term Memory
- Recent conversation context
- Current scene details
- Active topics and threads

### Long-term Memory
- Character relationships
- Established facts
- Story events
- User preferences

### World Knowledge
- Setting information
- Lore and rules
- NPC details

## Summarization Strategies

### Conversation Summary
1. Identify key events and decisions
2. Note relationship changes
3. Track plot progression
4. Preserve important dialogue
5. Remove redundant exchanges

### Character Memory
1. Track character development
2. Note learned information
3. Record emotional states
4. Update relationship status

## Memory Optimization Tips

1. **Prioritize**: Recent > Important > Background
2. **Compress**: Summarize old conversations
3. **Deduplicate**: Remove repeated information
4. **Categorize**: Organize by type/relevance
5. **Prune**: Remove outdated information

## Using Memory Tools

- `sillytavern_memory` tool for memory operations
- Actions: add, search, update, delete, summarize
- Use embeddings for semantic search
- Tag memories for easy retrieval

## Best Practices

1. Regularly summarize long conversations
2. Extract key facts after important scenes
3. Update character knowledge as it changes
4. Use World Info for static knowledge
5. Balance detail vs. context space
