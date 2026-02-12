/**
 * Vector Store for SillyTavern Memory
 *
 * High-level interface for vector-based memory storage and retrieval.
 * Combines embedding generation with vector indexing.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { MemoryEntry, MemoryBook, StoredMemoryBook } from "./types.js";
import {
  createEmbeddingManager,
  type EmbeddingConfig,
  type SillyTavernEmbeddingManager,
} from "./embedding-manager.js";
import {
  getMemoryIndex,
  closeMemoryIndex,
  type MemoryVectorIndex,
  type ScoredMemoryEntry,
  type IndexStatus,
} from "./memory-index.js";

/**
 * Vector store configuration
 */
export interface VectorStoreConfig {
  /** Enable vector search */
  enabled?: boolean;
  /** Embedding configuration */
  embedding?: EmbeddingConfig;
  /** Search configuration */
  search?: {
    /** Maximum results to return */
    maxResults?: number;
    /** Minimum similarity score (0-1) */
    minScore?: number;
    /** Vector weight in hybrid search (0-1) */
    vectorWeight?: number;
    /** Keyword weight in hybrid search (0-1) */
    keywordWeight?: number;
  };
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  /** The memory entry */
  entry: MemoryEntry;
  /** Similarity score (0-1) */
  score: number;
  /** How the match was found */
  matchType: "vector" | "keyword" | "hybrid";
}

/**
 * Sync progress callback
 */
export type SyncProgressCallback = (progress: {
  completed: number;
  total: number;
  label?: string;
}) => void;

/**
 * Vector store status
 */
export interface VectorStoreStatus {
  /** Whether vector search is enabled */
  enabled: boolean;
  /** Whether embedding provider is available */
  embeddingAvailable: boolean;
  /** Embedding provider info */
  embeddingProvider?: { id: string; model: string };
  /** Index status per book */
  indexes: Map<string, IndexStatus>;
}

/**
 * Vector Memory Store class
 */
export class VectorMemoryStore {
  private config: VectorStoreConfig;
  private embeddingManager: SillyTavernEmbeddingManager | null = null;
  private logger?: OpenClawPluginApi["logger"];
  private initialized = false;

  constructor(config: VectorStoreConfig, logger?: OpenClawPluginApi["logger"]) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize the vector store
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.config.enabled === false) {
      this.logger?.debug?.("[sillytavern] Vector store disabled by configuration");
      this.initialized = true;
      return;
    }

    try {
      this.embeddingManager = createEmbeddingManager(
        this.config.embedding || {},
        this.logger,
      );
      await this.embeddingManager.initialize();
      this.initialized = true;
      this.logger?.debug?.("[sillytavern] Vector store initialized");
    } catch (err) {
      this.logger?.warn?.(
        `[sillytavern] Vector store initialization failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      // Continue without vector search
      this.initialized = true;
    }
  }

  /**
   * Check if vector search is available
   */
  isAvailable(): boolean {
    return this.embeddingManager?.isAvailable() ?? false;
  }

  /**
   * Get the index for a memory book
   */
  getIndex(bookId: string): MemoryVectorIndex {
    return getMemoryIndex(bookId);
  }

  /**
   * Add a memory entry with embedding
   */
  async addEntry(bookId: string, entry: MemoryEntry): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const embedding = await this.embeddingManager!.embed(entry.content);
      const index = this.getIndex(bookId);
      const providerInfo = this.embeddingManager!.getProviderInfo();
      index.indexEntry(entry, embedding, providerInfo?.model || "unknown");

      this.logger?.debug?.(
        `[sillytavern] Indexed memory entry: ${entry.id} (${embedding.length} dims)`,
      );
    } catch (err) {
      this.logger?.warn?.(
        `[sillytavern] Failed to index memory entry: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Add multiple memory entries with embeddings
   */
  async addEntries(
    bookId: string,
    entries: MemoryEntry[],
    progress?: SyncProgressCallback,
  ): Promise<void> {
    if (!this.isAvailable() || entries.length === 0) {
      return;
    }

    try {
      const contents = entries.map((e) => e.content);
      const embeddings = await this.embeddingManager!.embedBatch(contents);
      const index = this.getIndex(bookId);
      const providerInfo = this.embeddingManager!.getProviderInfo();
      const model = providerInfo?.model || "unknown";

      const batch: Array<{ entry: MemoryEntry; embedding: number[] }> = [];
      for (let i = 0; i < entries.length; i++) {
        if (embeddings[i].length > 0) {
          batch.push({ entry: entries[i], embedding: embeddings[i] });
        }
        if (progress) {
          progress({ completed: i + 1, total: entries.length, label: "Indexing memories..." });
        }
      }

      index.indexBatch(batch, model);

      this.logger?.debug?.(
        `[sillytavern] Indexed ${batch.length} memory entries for book ${bookId}`,
      );
    } catch (err) {
      this.logger?.warn?.(
        `[sillytavern] Failed to batch index memory entries: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * Remove a memory entry from the index
   */
  removeEntry(bookId: string, entryId: string): void {
    const index = this.getIndex(bookId);
    index.removeEntry(entryId);
  }

  /**
   * Search for similar memories
   */
  async search(
    bookId: string,
    query: string,
    options?: {
      maxResults?: number;
      minScore?: number;
      useHybrid?: boolean;
    },
  ): Promise<VectorSearchResult[]> {
    const maxResults = options?.maxResults ?? this.config.search?.maxResults ?? 10;
    const minScore = options?.minScore ?? this.config.search?.minScore ?? 0.3;
    const useHybrid = options?.useHybrid ?? true;

    const index = this.getIndex(bookId);

    // If embedding is not available, fall back to keyword search
    if (!this.isAvailable()) {
      const results = index.searchKeyword(query, maxResults);
      return results.map((r) => ({
        entry: r.entry,
        score: r.score,
        matchType: r.matchType,
      }));
    }

    try {
      const queryEmbedding = await this.embeddingManager!.embed(query);

      let results: ScoredMemoryEntry[];
      if (useHybrid) {
        results = index.hybridSearch(queryEmbedding, query, maxResults, {
          vectorWeight: this.config.search?.vectorWeight ?? 0.7,
          keywordWeight: this.config.search?.keywordWeight ?? 0.3,
          minScore,
        });
      } else {
        results = index.searchVector(queryEmbedding, maxResults, minScore);
      }

      return results.map((r) => ({
        entry: r.entry,
        score: r.score,
        matchType: r.matchType,
      }));
    } catch (err) {
      this.logger?.warn?.(
        `[sillytavern] Vector search failed, falling back to keyword: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );

      // Fall back to keyword search
      const results = index.searchKeyword(query, maxResults);
      return results.map((r) => ({
        entry: r.entry,
        score: r.score,
        matchType: r.matchType,
      }));
    }
  }

  /**
   * Sync a memory book's entries to the vector index
   */
  async syncBook(
    book: MemoryBook | StoredMemoryBook,
    progress?: SyncProgressCallback,
  ): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const index = this.getIndex(book.id);
    const providerInfo = this.embeddingManager!.getProviderInfo();
    const model = providerInfo?.model || "unknown";

    // Find entries that need embedding
    const needsEmbedding = index.getEntriesNeedingEmbedding(model);

    // Also check for entries in the book that aren't in the index
    const indexedIds = new Set(index.getAllEntries().map((e) => e.id));
    const missingEntries = book.entries.filter((e) => !indexedIds.has(e.id));

    const toIndex = [...needsEmbedding, ...missingEntries];

    if (toIndex.length === 0) {
      this.logger?.debug?.(`[sillytavern] Book ${book.id} is already synced`);
      return;
    }

    this.logger?.debug?.(
      `[sillytavern] Syncing ${toIndex.length} entries for book ${book.id}`,
    );

    await this.addEntries(book.id, toIndex, progress);
  }

  /**
   * Get status of the vector store
   */
  status(): VectorStoreStatus {
    const indexes = new Map<string, IndexStatus>();

    // Note: We can't enumerate all indexes without knowing the book IDs
    // This would need to be called with specific book IDs

    return {
      enabled: this.config.enabled !== false,
      embeddingAvailable: this.isAvailable(),
      embeddingProvider: this.embeddingManager?.getProviderInfo() ?? undefined,
      indexes,
    };
  }

  /**
   * Get status for a specific book
   */
  getBookStatus(bookId: string): IndexStatus {
    const index = this.getIndex(bookId);
    return index.status();
  }

  /**
   * Close the vector store
   */
  close(bookId?: string): void {
    if (bookId) {
      closeMemoryIndex(bookId);
    }
  }
}

// Singleton instance
let vectorStoreInstance: VectorMemoryStore | null = null;

/**
 * Get or create the vector store instance
 */
export function getVectorStore(
  config?: VectorStoreConfig,
  logger?: OpenClawPluginApi["logger"],
): VectorMemoryStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new VectorMemoryStore(config || {}, logger);
  }
  return vectorStoreInstance;
}

/**
 * Initialize the vector store
 */
export async function initializeVectorStore(
  config: VectorStoreConfig,
  logger?: OpenClawPluginApi["logger"],
): Promise<VectorMemoryStore> {
  const store = getVectorStore(config, logger);
  await store.initialize();
  return store;
}

/**
 * Reset the vector store instance (for testing)
 */
export function resetVectorStore(): void {
  vectorStoreInstance = null;
}
