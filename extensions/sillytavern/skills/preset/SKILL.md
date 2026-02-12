---
name: preset
description: Manage SillyTavern presets - create, edit, and optimize generation settings for different use cases
metadata:
  {
    "sillytavern":
      {
        "emoji": "⚙️",
        "skillKey": "preset",
      },
  }
---

# Preset Management

You can help users manage their SillyTavern generation presets.

## Capabilities

- **Create** new presets with optimized settings
- **Edit** existing preset parameters
- **Compare** presets for different use cases
- **Recommend** settings based on model and use case
- **Import/Export** presets

## Key Preset Parameters

### Temperature & Sampling
- `temperature`: Randomness (0.1-2.0, typical: 0.7-1.0)
- `top_p`: Nucleus sampling threshold (0.0-1.0)
- `top_k`: Top-K sampling limit (1-100)
- `typical_p`: Typical sampling (0.0-1.0)
- `min_p`: Minimum probability cutoff

### Repetition Control
- `repetition_penalty`: Penalize repeated tokens (1.0-1.5)
- `repetition_penalty_range`: How far back to check
- `frequency_penalty`: Penalize frequent tokens
- `presence_penalty`: Penalize any repeated tokens

### Generation Limits
- `max_tokens`: Maximum response length
- `max_context_length`: Context window size
- `truncation_length`: When to truncate context

### Advanced
- `mirostat_mode`: Mirostat sampling (0, 1, or 2)
- `mirostat_tau`: Target entropy
- `mirostat_eta`: Learning rate
- `cfg_scale`: Classifier-free guidance scale

## Preset Recommendations

### Creative Writing
- Temperature: 0.9-1.1
- Top P: 0.95
- Repetition Penalty: 1.1-1.15

### Roleplay
- Temperature: 0.8-1.0
- Top P: 0.9
- Repetition Penalty: 1.1

### Technical/Factual
- Temperature: 0.3-0.5
- Top P: 0.8
- Repetition Penalty: 1.0

### Chat/Conversation
- Temperature: 0.7-0.9
- Top P: 0.9
- Repetition Penalty: 1.05

## Commands

- Use the `sillytavern_preset` tool to manage presets
- Actions: create, update, delete, list, get, recommend
