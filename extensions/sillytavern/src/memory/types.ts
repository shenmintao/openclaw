/**
 * Memory System Types for SillyTavern Plugin
 *
 * Implements a long-term and short-term memory system similar to SillyTavern's
 * memory extensions (e.g., VectorDB, Summarize, etc.)
 */

/**
 * Memory entry representing a single piece of remembered information
 */
export interface MemoryEntry {
  /** Unique identifier for the memory */
  id: string;
  /** The memory content/text */
  content: string;
  /** When the memory was created */
  createdAt: string;
  /** When the memory was last accessed */
  lastAccessedAt: string;
  /** Number of times this memory has been accessed */
  accessCount: number;
  /** Memory type: manual (user-added) or auto (AI-extracted) */
  type: "manual" | "auto";
  /** Optional keywords for keyword-based retrieval */
  keywords?: string[];
  /** Optional importance score (0-100) */
  importance?: number;
  /** Optional category/tag */
  category?: string;
  /** Optional source (e.g., session ID, message ID) */
  source?: string;
  /** Whether this memory is enabled */
  enabled: boolean;
}

/**
 * Memory book containing all memories for a character/session
 */
export interface MemoryBook {
  /** Unique identifier for the memory book */
  id: string;
  /** Name of the memory book (usually character name or session key) */
  name: string;
  /** Associated character card ID (optional) */
  characterId?: string;
  /** Associated session key (optional) */
  sessionKey?: string;
  /** When the memory book was created */
  createdAt: string;
  /** When the memory book was last updated */
  updatedAt: string;
  /** All memory entries */
  entries: MemoryEntry[];
  /** Memory book settings */
  settings: MemoryBookSettings;
}

/**
 * Settings for a memory book
 */
export interface MemoryBookSettings {
  /** Maximum number of memories to inject per request */
  maxMemoriesPerRequest: number;
  /** Maximum total tokens for injected memories */
  maxMemoryTokens: number;
  /** Whether to use keyword-based retrieval */
  useKeywordRetrieval: boolean;
  /** Whether to auto-extract memories from conversations */
  autoExtract: boolean;
  /** Minimum importance score for auto-injection */
  minImportanceForInjection: number;
  /** How to sort memories for injection */
  sortBy: "importance" | "recency" | "accessCount";
}

/**
 * Short-term memory configuration
 */
export interface ShortTermMemoryConfig {
  /** Whether short-term memory is enabled */
  enabled: boolean;
  /** Number of recent messages to keep as short-term memory */
  messageCount: number;
  /** Whether to summarize old messages instead of dropping them */
  summarizeOld: boolean;
  /** Threshold for triggering summarization (message count) */
  summarizeThreshold: number;
}

/**
 * Long-term memory configuration
 */
export interface LongTermMemoryConfig {
  /** Whether long-term memory is enabled */
  enabled: boolean;
  /** Maximum memories per character/session */
  maxMemories: number;
  /** Whether to auto-extract important information */
  autoExtract: boolean;
  /** Keywords that trigger memory extraction */
  extractionTriggers: string[];
  /** Prompt template for memory extraction */
  extractionPrompt?: string;
}

/**
 * Complete memory system configuration
 */
export interface MemorySystemConfig {
  /** Short-term memory settings */
  shortTerm: ShortTermMemoryConfig;
  /** Long-term memory settings */
  longTerm: LongTermMemoryConfig;
  /** Default memory book settings */
  defaultBookSettings: MemoryBookSettings;
}

/**
 * Memory retrieval result
 */
export interface MemoryRetrievalResult {
  /** Retrieved memories */
  memories: MemoryEntry[];
  /** Total memories in the book */
  totalMemories: number;
  /** Whether retrieval was truncated due to limits */
  truncated: boolean;
  /** Retrieval method used */
  method: "keyword" | "importance" | "recency" | "all" | "vector" | "hybrid";
}

/**
 * Memory injection context
 */
export interface MemoryInjectionContext {
  /** Current conversation messages */
  messages: unknown[];
  /** Current user prompt */
  prompt: string;
  /** Active character card name */
  characterName?: string;
  /** Session key */
  sessionKey?: string;
  /** Agent ID */
  agentId?: string;
}

/**
 * Default memory system configuration
 */
export const DEFAULT_MEMORY_CONFIG: MemorySystemConfig = {
  shortTerm: {
    enabled: true,
    messageCount: 20,
    summarizeOld: false,
    summarizeThreshold: 50,
  },
  longTerm: {
    enabled: true,
    maxMemories: 100,
    autoExtract: false,
    extractionTriggers: ["remember", "important", "don't forget", "note that"],
  },
  defaultBookSettings: {
    maxMemoriesPerRequest: 10,
    maxMemoryTokens: 1000,
    useKeywordRetrieval: true,
    autoExtract: false,
    minImportanceForInjection: 50,
    sortBy: "importance",
  },
};

/**
 * Stored memory book format (for persistence)
 */
export interface StoredMemoryBook extends MemoryBook {
  /** File path where the memory book is stored */
  filePath?: string;
}
