/**
 * Memory Vector Index for SillyTavern
 *
 * SQLite-based vector index for memory entries.
 * Each memory book has its own SQLite database for vector storage.
 */

import { DatabaseSync } from "node:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { MemoryEntry } from "./types.js";
import { cosineSimilarity } from "./embedding-manager.js";

/**
 * Scored memory entry from search
 */
export interface ScoredMemoryEntry {
  entry: MemoryEntry;
  score: number;
  matchType: "vector" | "keyword" | "hybrid";
}

/**
 * Index status information
 */
export interface IndexStatus {
  totalEntries: number;
  indexedEntries: number;
  model: string | null;
  lastUpdated: string | null;
  dbPath: string;
}

/**
 * Get the memory storage directory
 */
function getMemoryStorageDir(): string {
  const homeDir = os.homedir();
  const storageDir = path.join(homeDir, ".openclaw", "plugins", "sillytavern", "memories");

  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  return storageDir;
}

/**
 * Get the SQLite database path for a memory book
 */
function getIndexPath(bookId: string): string {
  return path.join(getMemoryStorageDir(), `${bookId}.sqlite`);
}

/**
 * Serialize embedding to buffer
 */
function serializeEmbedding(embedding: number[]): Buffer {
  const buffer = Buffer.alloc(embedding.length * 4);
  for (let i = 0; i < embedding.length; i++) {
    buffer.writeFloatLE(embedding[i], i * 4);
  }
  return buffer;
}

/**
 * Deserialize embedding from buffer
 */
function deserializeEmbedding(buffer: Buffer): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < buffer.length; i += 4) {
    embedding.push(buffer.readFloatLE(i));
  }
  return embedding;
}

/**
 * Memory Vector Index class
 */
export class MemoryVectorIndex {
  private db: DatabaseSync;
  private bookId: string;
  private dbPath: string;
  private model: string | null = null;

  constructor(bookId: string) {
    this.bookId = bookId;
    this.dbPath = getIndexPath(bookId);
    this.db = new DatabaseSync(this.dbPath);
    this.ensureSchema();
  }

  /**
   * Ensure database schema exists
   */
  private ensureSchema(): void {
    this.db.exec(`
      -- Memory entries table
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_accessed_at TEXT NOT NULL,
        access_count INTEGER DEFAULT 0,
        type TEXT DEFAULT 'manual',
        keywords TEXT,
        importance INTEGER DEFAULT 50,
        category TEXT,
        source TEXT,
        enabled INTEGER DEFAULT 1
      );

      -- Vector embeddings table
      CREATE TABLE IF NOT EXISTS vectors (
        entry_id TEXT PRIMARY KEY,
        embedding BLOB NOT NULL,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
      );

      -- Metadata table
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_entries_enabled ON entries(enabled);
      CREATE INDEX IF NOT EXISTS idx_entries_importance ON entries(importance);
      CREATE INDEX IF NOT EXISTS idx_vectors_model ON vectors(model);
    `);

    // Try to create FTS table (may fail on some SQLite versions)
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
          content,
          keywords,
          content=entries,
          content_rowid=rowid
        );
      `);
    } catch {
      // FTS not available, will use LIKE queries instead
    }

    // Load model from metadata
    const row = this.db.prepare(`SELECT value FROM meta WHERE key = 'model'`).get() as
      | { value: string }
      | undefined;
    if (row) {
      this.model = row.value;
    }
  }

  /**
   * Check if FTS is available
   */
  private hasFts(): boolean {
    try {
      this.db.prepare(`SELECT 1 FROM entries_fts LIMIT 1`).get();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Index a memory entry with its embedding
   */
  indexEntry(entry: MemoryEntry, embedding: number[], model: string): void {
    const now = new Date().toISOString();

    // Upsert entry
    this.db
      .prepare(
        `
      INSERT INTO entries (id, content, created_at, last_accessed_at, access_count, type, keywords, importance, category, source, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        last_accessed_at = excluded.last_accessed_at,
        access_count = excluded.access_count,
        type = excluded.type,
        keywords = excluded.keywords,
        importance = excluded.importance,
        category = excluded.category,
        source = excluded.source,
        enabled = excluded.enabled
    `,
      )
      .run(
        entry.id,
        entry.content,
        entry.createdAt,
        entry.lastAccessedAt,
        entry.accessCount,
        entry.type,
        entry.keywords ? JSON.stringify(entry.keywords) : null,
        entry.importance ?? 50,
        entry.category ?? null,
        entry.source ?? null,
        entry.enabled ? 1 : 0,
      );

    // Upsert embedding
    const embeddingBuffer = serializeEmbedding(embedding);
    this.db
      .prepare(
        `
      INSERT INTO vectors (entry_id, embedding, model, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(entry_id) DO UPDATE SET
        embedding = excluded.embedding,
        model = excluded.model,
        created_at = excluded.created_at
    `,
      )
      .run(entry.id, embeddingBuffer, model, now);

    // Update FTS if available
    if (this.hasFts()) {
      try {
        // Delete old FTS entry
        this.db.prepare(`DELETE FROM entries_fts WHERE rowid = (SELECT rowid FROM entries WHERE id = ?)`).run(entry.id);
        // Insert new FTS entry
        this.db
          .prepare(
            `INSERT INTO entries_fts(rowid, content, keywords) SELECT rowid, content, keywords FROM entries WHERE id = ?`,
          )
          .run(entry.id);
      } catch {
        // FTS update failed, ignore
      }
    }

    // Update model metadata
    if (this.model !== model) {
      this.model = model;
      this.db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('model', ?)`).run(model);
    }

    // Update last updated timestamp
    this.db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('last_updated', ?)`).run(now);
  }

  /**
   * Index multiple entries in batch
   */
  indexBatch(entries: Array<{ entry: MemoryEntry; embedding: number[] }>, model: string): void {
    this.db.exec("BEGIN TRANSACTION");
    try {
      for (const { entry, embedding } of entries) {
        this.indexEntry(entry, embedding, model);
      }
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  /**
   * Remove an entry from the index
   */
  removeEntry(entryId: string): void {
    // Remove from FTS first
    if (this.hasFts()) {
      try {
        this.db.prepare(`DELETE FROM entries_fts WHERE rowid = (SELECT rowid FROM entries WHERE id = ?)`).run(entryId);
      } catch {
        // Ignore FTS errors
      }
    }

    // Remove from vectors
    this.db.prepare(`DELETE FROM vectors WHERE entry_id = ?`).run(entryId);

    // Remove from entries
    this.db.prepare(`DELETE FROM entries WHERE id = ?`).run(entryId);
  }

  /**
   * Search by vector similarity
   */
  searchVector(queryEmbedding: number[], limit: number, minScore = 0): ScoredMemoryEntry[] {
    // Get all enabled entries with embeddings
    const rows = this.db
      .prepare(
        `
      SELECT e.*, v.embedding
      FROM entries e
      JOIN vectors v ON e.id = v.entry_id
      WHERE e.enabled = 1
    `,
      )
      .all() as Array<{
      id: string;
      content: string;
      created_at: string;
      last_accessed_at: string;
      access_count: number;
      type: string;
      keywords: string | null;
      importance: number;
      category: string | null;
      source: string | null;
      enabled: number;
      embedding: Buffer;
    }>;

    // Compute similarities
    const scored: ScoredMemoryEntry[] = [];
    for (const row of rows) {
      const embedding = deserializeEmbedding(row.embedding);
      const score = cosineSimilarity(queryEmbedding, embedding);

      if (score >= minScore) {
        scored.push({
          entry: this.rowToEntry(row),
          score,
          matchType: "vector",
        });
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit);
  }

  /**
   * Search by keyword (FTS or LIKE)
   */
  searchKeyword(query: string, limit: number): ScoredMemoryEntry[] {
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (keywords.length === 0) {
      return [];
    }

    let rows: Array<{
      id: string;
      content: string;
      created_at: string;
      last_accessed_at: string;
      access_count: number;
      type: string;
      keywords: string | null;
      importance: number;
      category: string | null;
      source: string | null;
      enabled: number;
      rank?: number;
    }>;

    if (this.hasFts()) {
      // Use FTS search
      const ftsQuery = keywords.map((k) => `"${k}"`).join(" OR ");
      try {
        rows = this.db
          .prepare(
            `
          SELECT e.*, bm25(entries_fts) as rank
          FROM entries e
          JOIN entries_fts fts ON e.rowid = fts.rowid
          WHERE e.enabled = 1 AND entries_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `,
          )
          .all(ftsQuery, limit) as typeof rows;
      } catch {
        // FTS query failed, fall back to LIKE
        rows = this.searchKeywordLike(keywords, limit);
      }
    } else {
      rows = this.searchKeywordLike(keywords, limit);
    }

    return rows.map((row) => ({
      entry: this.rowToEntry(row),
      score: row.rank ? Math.abs(row.rank) : 0.5, // BM25 scores are negative
      matchType: "keyword" as const,
    }));
  }

  /**
   * Fallback keyword search using LIKE
   */
  private searchKeywordLike(
    keywords: string[],
    limit: number,
  ): Array<{
    id: string;
    content: string;
    created_at: string;
    last_accessed_at: string;
    access_count: number;
    type: string;
    keywords: string | null;
    importance: number;
    category: string | null;
    source: string | null;
    enabled: number;
  }> {
    const conditions = keywords.map(() => "(content LIKE ? OR keywords LIKE ?)").join(" OR ");
    const params: string[] = [];
    for (const kw of keywords) {
      params.push(`%${kw}%`, `%${kw}%`);
    }
    params.push(String(limit));

    return this.db
      .prepare(
        `
      SELECT * FROM entries
      WHERE enabled = 1 AND (${conditions})
      LIMIT ?
    `,
      )
      .all(...params) as Array<{
      id: string;
      content: string;
      created_at: string;
      last_accessed_at: string;
      access_count: number;
      type: string;
      keywords: string | null;
      importance: number;
      category: string | null;
      source: string | null;
      enabled: number;
    }>;
  }

  /**
   * Hybrid search combining vector and keyword
   */
  hybridSearch(
    queryEmbedding: number[],
    queryText: string,
    limit: number,
    options?: {
      vectorWeight?: number;
      keywordWeight?: number;
      minScore?: number;
    },
  ): ScoredMemoryEntry[] {
    const vectorWeight = options?.vectorWeight ?? 0.7;
    const keywordWeight = options?.keywordWeight ?? 0.3;
    const minScore = options?.minScore ?? 0;

    // Get vector results
    const vectorResults = this.searchVector(queryEmbedding, limit * 2, 0);

    // Get keyword results
    const keywordResults = this.searchKeyword(queryText, limit * 2);

    // Merge results
    const merged = new Map<string, ScoredMemoryEntry>();

    for (const result of vectorResults) {
      merged.set(result.entry.id, {
        entry: result.entry,
        score: result.score * vectorWeight,
        matchType: "vector",
      });
    }

    for (const result of keywordResults) {
      const existing = merged.get(result.entry.id);
      if (existing) {
        // Combine scores
        existing.score += result.score * keywordWeight;
        existing.matchType = "hybrid";
      } else {
        merged.set(result.entry.id, {
          entry: result.entry,
          score: result.score * keywordWeight,
          matchType: "keyword",
        });
      }
    }

    // Filter and sort
    const results = Array.from(merged.values())
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Get all entries (for migration/sync)
   */
  getAllEntries(): MemoryEntry[] {
    const rows = this.db.prepare(`SELECT * FROM entries`).all() as Array<{
      id: string;
      content: string;
      created_at: string;
      last_accessed_at: string;
      access_count: number;
      type: string;
      keywords: string | null;
      importance: number;
      category: string | null;
      source: string | null;
      enabled: number;
    }>;

    return rows.map((row) => this.rowToEntry(row));
  }

  /**
   * Get entries that need embedding (no vector or different model)
   */
  getEntriesNeedingEmbedding(model: string): MemoryEntry[] {
    const rows = this.db
      .prepare(
        `
      SELECT e.* FROM entries e
      LEFT JOIN vectors v ON e.id = v.entry_id
      WHERE v.entry_id IS NULL OR v.model != ?
    `,
      )
      .all(model) as Array<{
      id: string;
      content: string;
      created_at: string;
      last_accessed_at: string;
      access_count: number;
      type: string;
      keywords: string | null;
      importance: number;
      category: string | null;
      source: string | null;
      enabled: number;
    }>;

    return rows.map((row) => this.rowToEntry(row));
  }

  /**
   * Check if an entry has embedding
   */
  hasEmbedding(entryId: string): boolean {
    const row = this.db.prepare(`SELECT 1 FROM vectors WHERE entry_id = ?`).get(entryId);
    return row !== undefined;
  }

  /**
   * Get index status
   */
  status(): IndexStatus {
    const totalRow = this.db.prepare(`SELECT COUNT(*) as count FROM entries`).get() as {
      count: number;
    };
    const indexedRow = this.db.prepare(`SELECT COUNT(*) as count FROM vectors`).get() as {
      count: number;
    };
    const lastUpdatedRow = this.db
      .prepare(`SELECT value FROM meta WHERE key = 'last_updated'`)
      .get() as { value: string } | undefined;

    return {
      totalEntries: totalRow.count,
      indexedEntries: indexedRow.count,
      model: this.model,
      lastUpdated: lastUpdatedRow?.value ?? null,
      dbPath: this.dbPath,
    };
  }

  /**
   * Convert database row to MemoryEntry
   */
  private rowToEntry(row: {
    id: string;
    content: string;
    created_at: string;
    last_accessed_at: string;
    access_count: number;
    type: string;
    keywords: string | null;
    importance: number;
    category: string | null;
    source: string | null;
    enabled: number;
  }): MemoryEntry {
    return {
      id: row.id,
      content: row.content,
      createdAt: row.created_at,
      lastAccessedAt: row.last_accessed_at,
      accessCount: row.access_count,
      type: row.type as "manual" | "auto",
      keywords: row.keywords ? (JSON.parse(row.keywords) as string[]) : undefined,
      importance: row.importance,
      category: row.category ?? undefined,
      source: row.source ?? undefined,
      enabled: row.enabled === 1,
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}

// Cache of open indexes
const indexCache = new Map<string, MemoryVectorIndex>();

/**
 * Get or create a memory vector index
 */
export function getMemoryIndex(bookId: string): MemoryVectorIndex {
  let index = indexCache.get(bookId);
  if (!index) {
    index = new MemoryVectorIndex(bookId);
    indexCache.set(bookId, index);
  }
  return index;
}

/**
 * Close a memory index
 */
export function closeMemoryIndex(bookId: string): void {
  const index = indexCache.get(bookId);
  if (index) {
    index.close();
    indexCache.delete(bookId);
  }
}

/**
 * Close all memory indexes
 */
export function closeAllMemoryIndexes(): void {
  for (const [bookId, index] of indexCache) {
    index.close();
    indexCache.delete(bookId);
  }
}
