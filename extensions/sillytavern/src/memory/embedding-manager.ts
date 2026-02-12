/**
 * Embedding Manager for SillyTavern Memory
 *
 * Provides embedding generation for memory entries using OpenClaw's embedding infrastructure.
 * Supports OpenAI, Voyage, Gemini, and local embedding providers.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

/**
 * Embedding provider configuration
 */
export interface EmbeddingConfig {
  /** Embedding provider: openai, voyage, gemini, local, or auto */
  provider?: "openai" | "voyage" | "gemini" | "local" | "auto";
  /** Model name (provider-specific) */
  model?: string;
  /** Fallback provider if primary fails */
  fallback?: "openai" | "voyage" | "gemini" | "local" | "none";
  /** API base URL (for OpenAI-compatible providers) */
  baseUrl?: string;
  /** API key (optional, uses environment variables by default) */
  apiKey?: string;
  /** Local model path (for local provider) */
  localModelPath?: string;
  /** Local model cache directory */
  localModelCacheDir?: string;
}

/**
 * Embedding provider interface
 */
export interface EmbeddingProvider {
  /** Provider ID */
  id: string;
  /** Model name */
  model: string;
  /** Maximum input tokens (if known) */
  maxInputTokens?: number;
  /** Generate embedding for a single text */
  embedQuery: (text: string) => Promise<number[]>;
  /** Generate embeddings for multiple texts */
  embedBatch: (texts: string[]) => Promise<number[][]>;
}

/**
 * Embedding manager result
 */
export interface EmbeddingManagerResult {
  /** The embedding provider */
  provider: EmbeddingProvider;
  /** Whether a fallback was used */
  fallbackUsed?: boolean;
  /** Fallback reason if applicable */
  fallbackReason?: string;
}

// Default embedding models by provider
const DEFAULT_MODELS: Record<string, string> = {
  openai: "text-embedding-3-small",
  voyage: "voyage-3-lite",
  gemini: "text-embedding-004",
  local: "hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf",
};

// Singleton cache for embedding providers
const providerCache = new Map<string, EmbeddingProvider>();

/**
 * Normalize embedding vector (L2 normalization)
 */
function normalizeEmbedding(vec: number[]): number[] {
  const sanitized = vec.map((value) => (Number.isFinite(value) ? value : 0));
  const magnitude = Math.sqrt(sanitized.reduce((sum, value) => sum + value * value, 0));
  if (magnitude < 1e-10) {
    return sanitized;
  }
  return sanitized.map((value) => value / magnitude);
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude < 1e-10) {
    return 0;
  }
  return dotProduct / magnitude;
}

/**
 * Create an OpenAI-compatible embedding provider
 */
async function createOpenAiProvider(config: EmbeddingConfig): Promise<EmbeddingProvider> {
  const model = config.model || DEFAULT_MODELS.openai;
  const baseUrl = config.baseUrl || "https://api.openai.com/v1";
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("No API key found for provider openai. Set OPENAI_API_KEY environment variable.");
  }

  const embed = async (texts: string[]): Promise<number[][]> => {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embedding failed: ${response.status} ${error}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    // Sort by index to ensure correct order
    const sorted = data.data.sort((a, b) => a.index - b.index);
    return sorted.map((item) => normalizeEmbedding(item.embedding));
  };

  return {
    id: "openai",
    model,
    maxInputTokens: 8191,
    embedQuery: async (text) => {
      const results = await embed([text]);
      return results[0];
    },
    embedBatch: embed,
  };
}

/**
 * Create a Voyage embedding provider
 */
async function createVoyageProvider(config: EmbeddingConfig): Promise<EmbeddingProvider> {
  const model = config.model || DEFAULT_MODELS.voyage;
  const baseUrl = config.baseUrl || "https://api.voyageai.com/v1";
  const apiKey = config.apiKey || process.env.VOYAGE_API_KEY;

  if (!apiKey) {
    throw new Error("No API key found for provider voyage. Set VOYAGE_API_KEY environment variable.");
  }

  const embed = async (texts: string[]): Promise<number[][]> => {
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Voyage embedding failed: ${response.status} ${error}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    const sorted = data.data.sort((a, b) => a.index - b.index);
    return sorted.map((item) => normalizeEmbedding(item.embedding));
  };

  return {
    id: "voyage",
    model,
    maxInputTokens: 32000,
    embedQuery: async (text) => {
      const results = await embed([text]);
      return results[0];
    },
    embedBatch: embed,
  };
}

/**
 * Create a Gemini embedding provider
 */
async function createGeminiProvider(config: EmbeddingConfig): Promise<EmbeddingProvider> {
  const model = config.model || DEFAULT_MODELS.gemini;
  const apiKey = config.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "No API key found for provider gemini. Set GEMINI_API_KEY or GOOGLE_API_KEY environment variable.",
    );
  }

  const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}`;

  const embed = async (texts: string[]): Promise<number[][]> => {
    const requests = texts.map((text) => ({
      model: `models/${model}`,
      content: { parts: [{ text }] },
    }));

    const response = await fetch(`${baseUrl}:batchEmbedContents?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini embedding failed: ${response.status} ${error}`);
    }

    const data = (await response.json()) as {
      embeddings: Array<{ values: number[] }>;
    };

    return data.embeddings.map((item) => normalizeEmbedding(item.values));
  };

  return {
    id: "gemini",
    model,
    maxInputTokens: 2048,
    embedQuery: async (text) => {
      const results = await embed([text]);
      return results[0];
    },
    embedBatch: embed,
  };
}

/**
 * Create a local embedding provider using node-llama-cpp
 * Note: This requires node-llama-cpp to be installed
 */
async function createLocalProvider(config: EmbeddingConfig): Promise<EmbeddingProvider> {
  const modelPath = config.localModelPath || DEFAULT_MODELS.local;

  // Try to dynamically import node-llama-cpp
  let nodeLlamaCpp: typeof import("node-llama-cpp");
  try {
    nodeLlamaCpp = await import("node-llama-cpp");
  } catch {
    throw new Error(
      "Local embeddings unavailable. node-llama-cpp is not installed.\n" +
        "To enable local embeddings:\n" +
        "1) Use Node 22 LTS\n" +
        "2) Install node-llama-cpp: npm install node-llama-cpp\n" +
        'Or use a remote provider: provider = "openai" or "voyage" or "gemini"',
    );
  }

  const { getLlama, resolveModelFile, LlamaLogLevel } = nodeLlamaCpp;

  let llama: Awaited<ReturnType<typeof getLlama>> | null = null;
  let embeddingModel: Awaited<ReturnType<Awaited<ReturnType<typeof getLlama>>["loadModel"]>> | null =
    null;
  let embeddingContext: Awaited<
    ReturnType<
      Awaited<ReturnType<Awaited<ReturnType<typeof getLlama>>["loadModel"]>>["createEmbeddingContext"]
    >
  > | null = null;

  const ensureContext = async () => {
    if (!llama) {
      llama = await getLlama({ logLevel: LlamaLogLevel.error });
    }
    if (!embeddingModel) {
      const resolved = await resolveModelFile(modelPath, config.localModelCacheDir || undefined);
      embeddingModel = await llama.loadModel({ modelPath: resolved });
    }
    if (!embeddingContext) {
      embeddingContext = await embeddingModel.createEmbeddingContext();
    }
    return embeddingContext;
  };

  return {
    id: "local",
    model: modelPath,
    embedQuery: async (text) => {
      const ctx = await ensureContext();
      const embedding = await ctx.getEmbeddingFor(text);
      return normalizeEmbedding(Array.from(embedding.vector));
    },
    embedBatch: async (texts) => {
      const ctx = await ensureContext();
      const embeddings = await Promise.all(
        texts.map(async (text) => {
          const embedding = await ctx.getEmbeddingFor(text);
          return normalizeEmbedding(Array.from(embedding.vector));
        }),
      );
      return embeddings;
    },
  };
}

/**
 * Get cache key for provider configuration
 */
function getCacheKey(config: EmbeddingConfig): string {
  const provider = config.provider || "auto";
  const model = config.model || DEFAULT_MODELS[provider] || "default";
  return `${provider}:${model}`;
}

/**
 * Create or get cached embedding provider
 */
export async function getEmbeddingProvider(
  config: EmbeddingConfig,
): Promise<EmbeddingManagerResult> {
  const cacheKey = getCacheKey(config);

  // Check cache first
  const cached = providerCache.get(cacheKey);
  if (cached) {
    return { provider: cached };
  }

  const provider = config.provider || "auto";
  const fallback = config.fallback || "none";

  const createProvider = async (
    id: "openai" | "voyage" | "gemini" | "local",
  ): Promise<EmbeddingProvider> => {
    switch (id) {
      case "openai":
        return createOpenAiProvider(config);
      case "voyage":
        return createVoyageProvider(config);
      case "gemini":
        return createGeminiProvider(config);
      case "local":
        return createLocalProvider(config);
    }
  };

  // Auto-select provider
  if (provider === "auto") {
    const providers: Array<"openai" | "voyage" | "gemini"> = ["openai", "voyage", "gemini"];
    const errors: string[] = [];

    for (const p of providers) {
      try {
        const result = await createProvider(p);
        providerCache.set(cacheKey, result);
        return { provider: result };
      } catch (err) {
        errors.push(`${p}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    throw new Error(`No embedding provider available.\n${errors.join("\n")}`);
  }

  // Try primary provider
  try {
    const result = await createProvider(provider);
    providerCache.set(cacheKey, result);
    return { provider: result };
  } catch (primaryErr) {
    const reason = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);

    // Try fallback if configured
    if (fallback && fallback !== "none" && fallback !== provider) {
      try {
        const result = await createProvider(fallback);
        providerCache.set(cacheKey, result);
        return {
          provider: result,
          fallbackUsed: true,
          fallbackReason: reason,
        };
      } catch (fallbackErr) {
        throw new Error(
          `${reason}\n\nFallback to ${fallback} failed: ${
            fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
          }`,
        );
      }
    }

    throw primaryErr;
  }
}

/**
 * Embedding manager class for SillyTavern memory
 */
export class SillyTavernEmbeddingManager {
  private provider: EmbeddingProvider | null = null;
  private config: EmbeddingConfig;
  private initPromise: Promise<void> | null = null;
  private logger?: OpenClawPluginApi["logger"];

  constructor(config: EmbeddingConfig, logger?: OpenClawPluginApi["logger"]) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize the embedding provider
   */
  async initialize(): Promise<void> {
    if (this.provider) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        const result = await getEmbeddingProvider(this.config);
        this.provider = result.provider;

        if (result.fallbackUsed) {
          this.logger?.warn?.(
            `[sillytavern] Embedding provider fallback: ${result.fallbackReason}`,
          );
        }

        this.logger?.debug?.(
          `[sillytavern] Embedding provider initialized: ${this.provider.id} (${this.provider.model})`,
        );
      } catch (err) {
        this.logger?.error?.(
          `[sillytavern] Failed to initialize embedding provider: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        throw err;
      }
    })();

    return this.initPromise;
  }

  /**
   * Check if embedding is available
   */
  isAvailable(): boolean {
    return this.provider !== null;
  }

  /**
   * Get the current provider info
   */
  getProviderInfo(): { id: string; model: string } | null {
    if (!this.provider) {
      return null;
    }
    return { id: this.provider.id, model: this.provider.model };
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    await this.initialize();
    if (!this.provider) {
      throw new Error("Embedding provider not initialized");
    }
    return this.provider.embedQuery(text);
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    await this.initialize();
    if (!this.provider) {
      throw new Error("Embedding provider not initialized");
    }

    // Filter out empty texts
    const nonEmpty = texts.filter((t) => t.trim().length > 0);
    if (nonEmpty.length === 0) {
      return texts.map(() => []);
    }

    const embeddings = await this.provider.embedBatch(nonEmpty);

    // Map back to original indices
    let embeddingIndex = 0;
    return texts.map((t) => {
      if (t.trim().length === 0) {
        return [];
      }
      return embeddings[embeddingIndex++];
    });
  }

  /**
   * Compute similarity between query and a list of embeddings
   */
  computeSimilarities(queryEmbedding: number[], embeddings: number[][]): number[] {
    return embeddings.map((emb) => cosineSimilarity(queryEmbedding, emb));
  }
}

/**
 * Create a new embedding manager instance
 */
export function createEmbeddingManager(
  config: EmbeddingConfig,
  logger?: OpenClawPluginApi["logger"],
): SillyTavernEmbeddingManager {
  return new SillyTavernEmbeddingManager(config, logger);
}
