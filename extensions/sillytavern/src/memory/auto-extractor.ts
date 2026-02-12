/**
 * SillyTavern Auto Memory Extractor
 *
 * Automatically extracts memories from conversations using LLM analysis.
 * This provides intelligent memory extraction without requiring keyword triggers.
 */

import type { MemoryEntry, MemoryBook } from "./types.js";
import { addMemoryWithVector, getOrCreateMemoryBook } from "./store.js";
import { getVectorStore, type VectorSearchResult } from "./vector-store.js";

/**
 * Memory extraction result from LLM
 */
export interface ExtractedMemory {
  /** The memory content */
  content: string;
  /** Keywords for the memory */
  keywords: string[];
  /** Importance score (1-10) */
  importance: number;
  /** Category of the memory */
  category: "fact" | "preference" | "relationship" | "event" | "trait" | "other";
}

/**
 * Extraction context
 */
export interface ExtractionContext {
  /** Character name */
  characterName?: string;
  /** User name */
  userName?: string;
  /** Session key */
  sessionKey?: string;
  /** Recent conversation messages */
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
}

/**
 * LLM provider interface for extraction
 */
export interface ExtractionLLMProvider {
  /** Generate completion for extraction prompt */
  complete(prompt: string): Promise<string>;
}

/**
 * Build the extraction prompt for LLM
 */
export function buildExtractionPrompt(context: ExtractionContext): string {
  const characterName = context.characterName || "Assistant";
  const userName = context.userName || "User";

  // Get the last few messages for context
  const recentMessages = context.messages.slice(-6);
  const conversationText = recentMessages
    .map((m) => {
      const speaker = m.role === "user" ? userName : m.role === "assistant" ? characterName : "System";
      return `${speaker}: ${m.content}`;
    })
    .join("\n\n");

  return `You are a memory extraction assistant. Analyze the following conversation and extract important information that should be remembered for future interactions.

Character: ${characterName}
User: ${userName}

Recent Conversation:
${conversationText}

Extract memories that are worth remembering. Focus on:
1. Facts about the user (name, preferences, background, etc.)
2. User preferences and likes/dislikes
3. Relationship dynamics between user and character
4. Important events or experiences mentioned
5. Character traits or behaviors the user appreciates
6. Any promises, commitments, or ongoing topics

For each memory, provide:
- content: A concise statement of what to remember
- keywords: 2-5 relevant keywords
- importance: Score from 1-10 (10 = critical to remember)
- category: One of "fact", "preference", "relationship", "event", "trait", "other"

Respond in JSON format:
{
  "memories": [
    {
      "content": "...",
      "keywords": ["...", "..."],
      "importance": 7,
      "category": "fact"
    }
  ],
  "reasoning": "Brief explanation of why these memories were extracted"
}

If there's nothing significant to remember from this conversation, respond with:
{
  "memories": [],
  "reasoning": "No significant new information to remember"
}

Important:
- Only extract NEW information, not things that would already be known
- Be concise but complete in the content
- Higher importance for personal details and preferences
- Lower importance for casual mentions or temporary topics`;
}

/**
 * Parse LLM response to extract memories
 */
export function parseExtractionResponse(response: string): ExtractedMemory[] {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      memories?: Array<{
        content?: string;
        keywords?: string[];
        importance?: number;
        category?: string;
      }>;
    };

    if (!parsed.memories || !Array.isArray(parsed.memories)) {
      return [];
    }

    return parsed.memories
      .filter((m) => m.content && typeof m.content === "string")
      .map((m) => ({
        content: m.content!,
        keywords: Array.isArray(m.keywords) ? m.keywords.filter((k) => typeof k === "string") : [],
        importance: typeof m.importance === "number" ? Math.min(10, Math.max(1, m.importance)) : 5,
        category: validateCategory(m.category),
      }));
  } catch {
    return [];
  }
}

/**
 * Validate category value
 */
function validateCategory(
  category: unknown
): "fact" | "preference" | "relationship" | "event" | "trait" | "other" {
  const validCategories = ["fact", "preference", "relationship", "event", "trait", "other"];
  if (typeof category === "string" && validCategories.includes(category)) {
    return category as "fact" | "preference" | "relationship" | "event" | "trait" | "other";
  }
  return "other";
}

/**
 * Check if a memory is similar to existing memories (deduplication)
 */
export async function isDuplicateMemory(
  bookId: string,
  content: string,
  similarityThreshold = 0.85
): Promise<boolean> {
  try {
    const vectorStore = getVectorStore();
    if (!vectorStore.isAvailable()) {
      return false;
    }

    // Search for similar memories
    const results = await vectorStore.search(bookId, content, { maxResults: 3, minScore: similarityThreshold });

    // If we find a very similar memory, consider it a duplicate
    return results.some((r: VectorSearchResult) => r.score >= similarityThreshold);
  } catch {
    return false;
  }
}

/**
 * Auto-extract memories from a conversation
 */
export async function autoExtractMemories(params: {
  context: ExtractionContext;
  llmProvider: ExtractionLLMProvider;
  bookId?: string;
  deduplicateThreshold?: number;
}): Promise<{
  extracted: ExtractedMemory[];
  saved: MemoryEntry[];
  duplicates: ExtractedMemory[];
}> {
  const { context, llmProvider, deduplicateThreshold = 0.85 } = params;

  // Build extraction prompt
  const prompt = buildExtractionPrompt(context);

  // Get LLM response
  const response = await llmProvider.complete(prompt);

  // Parse extracted memories
  const extracted = parseExtractionResponse(response);

  if (extracted.length === 0) {
    return { extracted: [], saved: [], duplicates: [] };
  }

  // Get or create memory book
  const book = getOrCreateMemoryBook({
    characterId: context.characterName,
    sessionKey: context.sessionKey,
  });

  const saved: MemoryEntry[] = [];
  const duplicates: ExtractedMemory[] = [];

  // Process each extracted memory
  for (const memory of extracted) {
    // Check for duplicates using vector similarity
    const isDuplicate = await isDuplicateMemory(book.id, memory.content, deduplicateThreshold);

    if (isDuplicate) {
      duplicates.push(memory);
      continue;
    }

    // Add memory with vector indexing
    const entry = await addMemoryWithVector(book.id, {
      content: memory.content,
      keywords: memory.keywords,
      importance: memory.importance,
      category: memory.category,
    });

    if (entry) {
      saved.push(entry);
    }
  }

  return { extracted, saved, duplicates };
}

/**
 * Create a simple LLM provider from OpenClaw's agent API
 */
export function createAgentLLMProvider(
  agentComplete: (prompt: string) => Promise<string>
): ExtractionLLMProvider {
  return {
    complete: agentComplete,
  };
}

/**
 * Extraction mode configuration
 */
export type ExtractionMode = "off" | "trigger" | "auto";

/**
 * Check if extraction should run based on mode and context
 */
export function shouldExtract(params: {
  mode: ExtractionMode;
  messages: Array<{ role: string; content: string }>;
  triggerPatterns?: RegExp[];
}): boolean {
  const { mode, messages, triggerPatterns } = params;

  if (mode === "off") {
    return false;
  }

  if (mode === "auto") {
    // Auto mode: always extract if there are new messages
    return messages.length > 0;
  }

  if (mode === "trigger") {
    // Trigger mode: check for trigger patterns
    const defaultPatterns = [
      /\bremember\b/i,
      /\bdon'?t forget\b/i,
      /\bkeep in mind\b/i,
      /\b记住\b/,
      /\b别忘了\b/,
      /\b不要忘记\b/,
    ];

    const patterns = triggerPatterns || defaultPatterns;
    const lastUserMessage = messages.filter((m) => m.role === "user").pop();

    if (!lastUserMessage) {
      return false;
    }

    return patterns.some((p) => p.test(lastUserMessage.content));
  }

  return false;
}

/**
 * Get extraction statistics for a memory book
 */
export function getExtractionStats(book: MemoryBook): {
  totalMemories: number;
  byCategory: Record<string, number>;
  avgImportance: number;
  recentCount: number;
} {
  const entries = book.entries;
  const byCategory: Record<string, number> = {};
  let totalImportance = 0;
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  let recentCount = 0;

  for (const entry of entries) {
    const category = entry.category || "other";
    byCategory[category] = (byCategory[category] || 0) + 1;
    totalImportance += entry.importance ?? 5;
    const createdAtMs = typeof entry.createdAt === "string" ? new Date(entry.createdAt).getTime() : entry.createdAt;
    if (createdAtMs > oneDayAgo) {
      recentCount++;
    }
  }

  return {
    totalMemories: entries.length,
    byCategory,
    avgImportance: entries.length > 0 ? totalImportance / entries.length : 0,
    recentCount,
  };
}
