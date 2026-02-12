---
name: prompt-engineering
description: Optimize prompts and system instructions for better AI responses in SillyTavern
metadata:
  {
    "sillytavern":
      {
        "emoji": "✨",
        "skillKey": "prompt-engineering",
      },
  }
---

# Prompt Engineering for SillyTavern

You can help users craft better prompts and system instructions.

## Capabilities

- **System Prompt Optimization**: Improve character system prompts
- **Jailbreak Crafting**: Create effective jailbreak prompts
- **Instruction Tuning**: Fine-tune post-history instructions
- **Context Management**: Optimize context usage
- **Macro Usage**: Leverage SillyTavern macros effectively

## System Prompt Structure

### Recommended Order
1. Core character identity
2. Personality traits
3. Speaking style
4. Behavioral guidelines
5. World/setting context
6. Response format instructions

### Effective Techniques
- Be specific and concrete
- Use positive instructions ("do X" vs "don't do Y")
- Include examples when helpful
- Layer instructions by priority
- Test and iterate

## SillyTavern Macros

### Character Macros
- `{{char}}`: Character name
- `{{user}}`: User's name
- `{{persona}}`: User's persona description

### Context Macros
- `{{lastMessage}}`: Previous message
- `{{lastCharMessage}}`: Last character message
- `{{lastUserMessage}}`: Last user message
- `{{messageId}}`: Current message ID

### Utility Macros
- `{{time}}`: Current time
- `{{date}}`: Current date
- `{{random:a,b,c}}`: Random selection
- `{{roll:d20}}`: Dice roll
- `{{pick::${options}}}`: Pick from options

### Conditional Macros
- `{{#if condition}}...{{/if}}`
- `{{#unless condition}}...{{/unless}}`

## Jailbreak Strategies

### Narrative Framing
- Frame as collaborative storytelling
- Emphasize fictional context
- Use "as a character" framing

### Instruction Layering
- Primary instructions in system prompt
- Reinforcement in post-history
- Context-specific in scenario

## Context Optimization

1. Prioritize recent messages
2. Use World Info for static knowledge
3. Summarize long conversations
4. Remove redundant information
5. Balance detail vs. token usage
