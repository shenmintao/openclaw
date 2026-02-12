/**
 * Memory Store for SillyTavern Plugin
 *
 * Handles persistence and retrieval of memory books.
 * Supports both keyword-based and vector-based (semantic) search.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type {
  MemoryBook,
  MemoryEntry,
  MemoryBookSettings,
  StoredMemoryBook,
  MemoryRetrievalResult,
} from "./types.js";

// Re-export vector store components
export {
  VectorMemoryStore,
  getVectorStore,
  initializeVectorStore,
  resetVectorStore,
  type VectorStoreConfig,
  type VectorSearchResult,
  type VectorStoreStatus,
} from "./vector-store.js";

export {
  SillyTavernEmbeddingManager,
  createEmbeddingManager,
  getEmbeddingProvider,
  cosineSimilarity,
  type EmbeddingConfig,
  type EmbeddingProvider,
} from "./embedding-manager.js";

export {
  MemoryVectorIndex,
  getMemoryIndex,
  closeMemoryIndex,
  closeAllMemoryIndexes,
  type ScoredMemoryEntry,
  type IndexStatus,
} from "./memory-index.js";

export {
  autoExtractMemories,
  buildExtractionPrompt,
  parseExtractionResponse,
  isDuplicateMemory,
  shouldExtract,
  getExtractionStats,
  createAgentLLMProvider,
  type ExtractedMemory,
  type ExtractionContext,
  type ExtractionLLMProvider,
  type ExtractionMode,
} from "./auto-extractor.js";

/**
 * Get the memory storage directory
 */
function getMemoryStorageDir(): string {
  const homeDir = os.homedir();
  const storageDir = path.join(homeDir, ".openclaw", "plugins", "sillytavern", "memories");

  // Ensure directory exists
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  return storageDir;
}

/**
 * Generate a unique memory ID
 */
function generateMemoryId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `mem-${timestamp}-${random}`;
}

/**
 * Generate a unique memory book ID
 */
function generateMemoryBookId(name: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 20);
  return `mb-${nameSlug}-${timestamp}-${random}`;
}

/**
 * Get the file path for a memory book
 */
function getMemoryBookPath(bookId: string): string {
  return path.join(getMemoryStorageDir(), `${bookId}.json`);
}

/**
 * Default memory book settings
 */
const DEFAULT_BOOK_SETTINGS: MemoryBookSettings = {
  maxMemoriesPerRequest: 10,
  maxMemoryTokens: 1000,
  useKeywordRetrieval: true,
  autoExtract: false,
  minImportanceForInjection: 50,
  sortBy: "importance",
};

/**
 * Load all memory books
 */
export function loadAllMemoryBooks(): StoredMemoryBook[] {
  const storageDir = getMemoryStorageDir();
  const books: StoredMemoryBook[] = [];

  try {
    const files = fs.readdirSync(storageDir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        try {
          const filePath = path.join(storageDir, file);
          const content = fs.readFileSync(filePath, "utf-8");
          const book = JSON.parse(content) as StoredMemoryBook;
          book.filePath = filePath;
          books.push(book);
        } catch {
          // Skip invalid files
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return books;
}

/**
 * Load a memory book by ID
 */
export function loadMemoryBook(bookId: string): StoredMemoryBook | null {
  const filePath = getMemoryBookPath(bookId);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const book = JSON.parse(content) as StoredMemoryBook;
    book.filePath = filePath;
    return book;
  } catch {
    return null;
  }
}

/**
 * Load memory book by character ID
 */
export function loadMemoryBookByCharacter(characterId: string): StoredMemoryBook | null {
  const books = loadAllMemoryBooks();
  return books.find((book) => book.characterId === characterId) ?? null;
}

/**
 * Load memory book by session key
 */
export function loadMemoryBookBySession(sessionKey: string): StoredMemoryBook | null {
  const books = loadAllMemoryBooks();
  return books.find((book) => book.sessionKey === sessionKey) ?? null;
}

/**
 * Save a memory book
 */
export function saveMemoryBook(book: MemoryBook): StoredMemoryBook {
  const filePath = getMemoryBookPath(book.id);
  const storedBook: StoredMemoryBook = {
    ...book,
    updatedAt: new Date().toISOString(),
    filePath,
  };

  fs.writeFileSync(filePath, JSON.stringify(storedBook, null, 2), "utf-8");
  return storedBook;
}

/**
 * Create a new memory book
 */
export function createMemoryBook(params: {
  name: string;
  characterId?: string;
  sessionKey?: string;
  settings?: Partial<MemoryBookSettings>;
}): StoredMemoryBook {
  const now = new Date().toISOString();
  const book: MemoryBook = {
    id: generateMemoryBookId(params.name),
    name: params.name,
    characterId: params.characterId,
    sessionKey: params.sessionKey,
    createdAt: now,
    updatedAt: now,
    entries: [],
    settings: {
      ...DEFAULT_BOOK_SETTINGS,
      ...params.settings,
    },
  };

  return saveMemoryBook(book);
}

/**
 * Delete a memory book
 */
export function deleteMemoryBook(bookId: string): boolean {
  const filePath = getMemoryBookPath(bookId);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Add a memory entry to a book
 */
export function addMemory(
  bookId: string,
  params: {
    content: string;
    type?: "manual" | "auto";
    keywords?: string[];
    importance?: number;
    category?: string;
    source?: string;
  },
): MemoryEntry | null {
  const book = loadMemoryBook(bookId);
  if (!book) {
    return null;
  }

  const now = new Date().toISOString();
  const entry: MemoryEntry = {
    id: generateMemoryId(),
    content: params.content,
    createdAt: now,
    lastAccessedAt: now,
    accessCount: 0,
    type: params.type ?? "manual",
    keywords: params.keywords,
    importance: params.importance ?? 50,
    category: params.category,
    source: params.source,
    enabled: true,
  };

  book.entries.push(entry);
  saveMemoryBook(book);

  return entry;
}

/**
 * Update a memory entry
 */
export function updateMemory(
  bookId: string,
  memoryId: string,
  updates: Partial<Omit<MemoryEntry, "id" | "createdAt">>,
): MemoryEntry | null {
  const book = loadMemoryBook(bookId);
  if (!book) {
    return null;
  }

  const entryIndex = book.entries.findIndex((e) => e.id === memoryId);
  if (entryIndex === -1) {
    return null;
  }

  book.entries[entryIndex] = {
    ...book.entries[entryIndex],
    ...updates,
  };

  saveMemoryBook(book);
  return book.entries[entryIndex];
}

/**
 * Delete a memory entry
 */
export function deleteMemory(bookId: string, memoryId: string): boolean {
  const book = loadMemoryBook(bookId);
  if (!book) {
    return false;
  }

  const entryIndex = book.entries.findIndex((e) => e.id === memoryId);
  if (entryIndex === -1) {
    return false;
  }

  book.entries.splice(entryIndex, 1);
  saveMemoryBook(book);

  return true;
}

/**
 * Retrieve memories based on context
 */
export function retrieveMemories(
  bookId: string,
  context: string,
  options?: {
    maxMemories?: number;
    minImportance?: number;
    keywords?: string[];
    sortBy?: "importance" | "recency" | "accessCount";
  },
): MemoryRetrievalResult {
  const book = loadMemoryBook(bookId);
  if (!book) {
    return {
      memories: [],
      totalMemories: 0,
      truncated: false,
      method: "all",
    };
  }

  const maxMemories = options?.maxMemories ?? book.settings.maxMemoriesPerRequest;
  const minImportance = options?.minImportance ?? book.settings.minImportanceForInjection;
  const sortBy = options?.sortBy ?? book.settings.sortBy;

  // Filter enabled memories with minimum importance
  let filtered = book.entries.filter(
    (entry) => entry.enabled && (entry.importance ?? 50) >= minImportance,
  );

  // Keyword-based filtering if context or keywords provided
  let method: MemoryRetrievalResult["method"] = "all";
  const searchKeywords = options?.keywords ?? extractKeywords(context);

  if (searchKeywords.length > 0 && book.settings.useKeywordRetrieval) {
    method = "keyword";
    filtered = filtered.filter((entry) => {
      // Check if any entry keyword matches search keywords
      if (entry.keywords && entry.keywords.length > 0) {
        return entry.keywords.some((k) =>
          searchKeywords.some((sk) => k.toLowerCase().includes(sk.toLowerCase())),
        );
      }
      // Fall back to content matching
      return searchKeywords.some((sk) => entry.content.toLowerCase().includes(sk.toLowerCase()));
    });
  }

  // Sort memories
  switch (sortBy) {
    case "importance":
      method = method === "keyword" ? "keyword" : "importance";
      filtered.sort((a, b) => (b.importance ?? 50) - (a.importance ?? 50));
      break;
    case "recency":
      method = method === "keyword" ? "keyword" : "recency";
      filtered.sort(
        (a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime(),
      );
      break;
    case "accessCount":
      filtered.sort((a, b) => b.accessCount - a.accessCount);
      break;
  }

  // Truncate to max memories
  const truncated = filtered.length > maxMemories;
  const memories = filtered.slice(0, maxMemories);

  // Update access counts and timestamps
  const now = new Date().toISOString();
  for (const memory of memories) {
    const entry = book.entries.find((e) => e.id === memory.id);
    if (entry) {
      entry.lastAccessedAt = now;
      entry.accessCount += 1;
    }
  }
  saveMemoryBook(book);

  return {
    memories,
    totalMemories: book.entries.length,
    truncated,
    method,
  };
}

/**
 * Extract keywords from text for memory retrieval
 */
function extractKeywords(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Simple keyword extraction: split by whitespace and filter
  const words = text
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff]/g, " ") // Keep alphanumeric and Chinese characters
    .split(/\s+/)
    .filter((word) => word.length > 2); // Filter short words

  // Remove common stop words
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "can",
    "and",
    "or",
    "but",
    "if",
    "then",
    "else",
    "when",
    "where",
    "why",
    "how",
    "what",
    "which",
    "who",
    "whom",
    "this",
    "that",
    "these",
    "those",
    "for",
    "with",
    "about",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "from",
    "up",
    "down",
    "in",
    "out",
    "on",
    "off",
    "over",
    "under",
    "again",
    "further",
    "then",
    "once",
    "here",
    "there",
    "all",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "just",
    "的",
    "是",
    "在",
    "了",
    "和",
    "与",
    "或",
    "但",
    "如果",
    "那么",
    "这",
    "那",
    "这个",
    "那个",
    "我",
    "你",
    "他",
    "她",
    "它",
    "我们",
    "你们",
    "他们",
  ]);

  return [...new Set(words.filter((word) => !stopWords.has(word)))];
}

/**
 * Build memory prompt for injection
 */
export function buildMemoryPrompt(memories: MemoryEntry[]): string {
  if (memories.length === 0) {
    return "";
  }

  const lines = ["## Long-term Memories", ""];

  for (const memory of memories) {
    const categoryPrefix = memory.category ? `[${memory.category}] ` : "";
    lines.push(`- ${categoryPrefix}${memory.content}`);
  }

  return lines.join("\n");
}

/**
 * Get or create a memory book for a character/session
 */
export function getOrCreateMemoryBook(params: {
  characterId?: string;
  characterName?: string;
  sessionKey?: string;
}): StoredMemoryBook {
  // Try to find existing book
  if (params.characterId) {
    const existing = loadMemoryBookByCharacter(params.characterId);
    if (existing) {
      return existing;
    }
  }

  if (params.sessionKey) {
    const existing = loadMemoryBookBySession(params.sessionKey);
    if (existing) {
      return existing;
    }
  }

  // Create new book
  const name = params.characterName ?? params.sessionKey ?? "Default";
  return createMemoryBook({
    name,
    characterId: params.characterId,
    sessionKey: params.sessionKey,
  });
}

// ============================================================================
// Vector Search Integration
// ============================================================================

import { getVectorStore, type VectorSearchResult } from "./vector-store.js";

/**
 * Extended retrieval result with vector search support
 */
export interface VectorRetrievalResult extends MemoryRetrievalResult {
  /** Whether vector search was used */
  vectorSearchUsed: boolean;
  /** Vector search scores (if available) */
  scores?: number[];
}

/**
 * Retrieve memories using vector search (semantic similarity)
 * Falls back to keyword search if vector search is not available
 */
export async function retrieveMemoriesWithVector(
  bookId: string,
  context: string,
  options?: {
    maxMemories?: number;
    minImportance?: number;
    minScore?: number;
    useHybrid?: boolean;
  },
): Promise<VectorRetrievalResult> {
  const book = loadMemoryBook(bookId);
  if (!book) {
    return {
      memories: [],
      totalMemories: 0,
      truncated: false,
      method: "all",
      vectorSearchUsed: false,
    };
  }

  const maxMemories = options?.maxMemories ?? book.settings.maxMemoriesPerRequest;
  const minImportance = options?.minImportance ?? book.settings.minImportanceForInjection;
  const minScore = options?.minScore ?? 0.3;
  const useHybrid = options?.useHybrid ?? true;

  // Try vector search first
  const vectorStore = getVectorStore();

  if (vectorStore.isAvailable()) {
    try {
      const results = await vectorStore.search(bookId, context, {
        maxResults: maxMemories * 2, // Get more results to filter by importance
        minScore,
        useHybrid,
      });

      // Filter by importance and enabled status
      const filtered = results.filter(
        (r) => r.entry.enabled && (r.entry.importance ?? 50) >= minImportance,
      );

      // Take top results
      const memories = filtered.slice(0, maxMemories).map((r) => r.entry);
      const scores = filtered.slice(0, maxMemories).map((r) => r.score);

      // Update access counts
      const now = new Date().toISOString();
      for (const memory of memories) {
        const entry = book.entries.find((e) => e.id === memory.id);
        if (entry) {
          entry.lastAccessedAt = now;
          entry.accessCount += 1;
        }
      }
      saveMemoryBook(book);

      return {
        memories,
        totalMemories: book.entries.length,
        truncated: filtered.length > maxMemories,
        method: useHybrid ? "hybrid" : "vector",
        vectorSearchUsed: true,
        scores,
      };
    } catch {
      // Fall back to keyword search
    }
  }

  // Fall back to keyword-based retrieval
  const result = retrieveMemories(bookId, context, {
    maxMemories,
    minImportance,
  });

  return {
    ...result,
    vectorSearchUsed: false,
  };
}

/**
 * Sync a memory book to the vector index
 */
export async function syncMemoryBookToVector(
  bookId: string,
  progress?: (update: { completed: number; total: number; label?: string }) => void,
): Promise<void> {
  const book = loadMemoryBook(bookId);
  if (!book) {
    return;
  }

  const vectorStore = getVectorStore();
  if (!vectorStore.isAvailable()) {
    return;
  }

  await vectorStore.syncBook(book, progress);
}

/**
 * Add a memory entry and index it in the vector store
 */
export async function addMemoryWithVector(
  bookId: string,
  params: {
    content: string;
    type?: "manual" | "auto";
    keywords?: string[];
    importance?: number;
    category?: string;
    source?: string;
  },
): Promise<MemoryEntry | null> {
  // Add to JSON store
  const entry = addMemory(bookId, params);
  if (!entry) {
    return null;
  }

  // Index in vector store
  const vectorStore = getVectorStore();
  if (vectorStore.isAvailable()) {
    try {
      await vectorStore.addEntry(bookId, entry);
    } catch {
      // Vector indexing failed, but entry is still saved
    }
  }

  return entry;
}

/**
 * Delete a memory entry and remove it from the vector index
 */
export function deleteMemoryWithVector(bookId: string, memoryId: string): boolean {
  // Remove from vector store first
  const vectorStore = getVectorStore();
  vectorStore.removeEntry(bookId, memoryId);

  // Remove from JSON store
  return deleteMemory(bookId, memoryId);
}

/**
 * Get vector index status for a memory book
 */
export function getMemoryBookVectorStatus(bookId: string): {
  indexed: boolean;
  totalEntries: number;
  indexedEntries: number;
  model: string | null;
} {
  const vectorStore = getVectorStore();
  if (!vectorStore.isAvailable()) {
    return {
      indexed: false,
      totalEntries: 0,
      indexedEntries: 0,
      model: null,
    };
  }

  const status = vectorStore.getBookStatus(bookId);
  return {
    indexed: status.indexedEntries > 0,
    totalEntries: status.totalEntries,
    indexedEntries: status.indexedEntries,
    model: status.model,
  };
}
