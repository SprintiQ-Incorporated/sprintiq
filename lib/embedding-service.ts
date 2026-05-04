/**
 * Voyage AI Embedding Service
 *
 * Centralized embedding generation service using Voyage AI.
 * Replaces OpenAI embeddings for cost efficiency.
 *
 * Features:
 * - Single and batch embedding generation
 * - Rate limiting (100ms between requests)
 * - 30 second timeout
 * - Two-tier caching: In-memory (fast) + Redis (persistent)
 * - Health check function
 */

// ============================================================================
// Configuration
// ============================================================================

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-large-2"; // 1536 dimensions - compatible with pgvector
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds
const RATE_LIMIT_MS = 100; // 100ms between requests
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for in-memory
const REDIS_CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours for Redis (embeddings don't change)
const MAX_RETRIES = 5; // Maximum retry attempts for rate limit errors
const BASE_DELAY_MS = 2000; // Base delay for exponential backoff (2 seconds)

// ============================================================================
// Redis Client (Lazy Initialization)
// ============================================================================

let redisClient: any = null;
let redisInitialized = false;

async function getRedisClient() {
  if (redisInitialized) return redisClient;

  const hasRedisConfig =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!hasRedisConfig) {
    // Embedding cache is less critical than rate limiting, but still beneficial
    // Without Redis, each serverless instance regenerates embeddings independently
    const isProduction = process.env.NODE_ENV === 'production' ||
                        process.env.VERCEL_ENV === 'production';
    if (isProduction) {}
    redisInitialized = true;
    return null;
  }

  try {
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    redisInitialized = true;
    return redisClient;
  } catch (error) {
    redisInitialized = true;
    return null;
  }
}

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  usage?: {
    totalTokens: number;
  };
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  model: string;
  usage?: {
    totalTokens: number;
  };
}

export interface EmbeddingServiceHealth {
  healthy: boolean;
  provider: "voyage";
  model: string;
  apiKeyConfigured: boolean;
  error?: string;
}

// ============================================================================
// State
// ============================================================================

let lastRequestTime = 0;
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Wait for rate limit if needed
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    const delay = RATE_LIMIT_MS - timeSinceLastRequest;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  lastRequestTime = Date.now();
}

/**
 * Generate a hash key for embedding cache (shorter keys for Redis)
 */
function getEmbeddingCacheKey(text: string): string {
  const normalizedText = text.toLowerCase().trim();
  // Use first 100 chars + length as simple hash for in-memory
  return `${normalizedText.substring(0, 100)}_${normalizedText.length}`;
}

/**
 * Get cached embedding if available and not expired
 * Checks in-memory first, then Redis
 */
async function getCachedEmbeddingAsync(text: string): Promise<number[] | null> {
  const cacheKey = getEmbeddingCacheKey(text);

  // Check in-memory cache first (fast)
  const cached = embeddingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.embedding;
  }

  // Clean up expired in-memory entry
  if (cached) {
    embeddingCache.delete(cacheKey);
  }

  // Try Redis for persistent cache
  try {
    const redis = await getRedisClient();
    if (redis) {
      const redisKey = `emb:${cacheKey}`;
      const cachedJson = await redis.get(redisKey);
      if (cachedJson) {
        const embedding = typeof cachedJson === "string" ? JSON.parse(cachedJson) : cachedJson;
        // Populate in-memory cache
        embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });
        return embedding as number[];
      }
    }
  } catch (error) {
    // Silently fail Redis - in-memory cache miss is fine
  }

  return null;
}

/**
 * Synchronous in-memory cache check (for backward compatibility)
 */
function getCachedEmbedding(text: string): number[] | null {
  const cacheKey = getEmbeddingCacheKey(text);
  const cached = embeddingCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.embedding;
  }

  if (cached) {
    embeddingCache.delete(cacheKey);
  }

  return null;
}

/**
 * Cache an embedding (in-memory and Redis)
 */
async function cacheEmbeddingAsync(text: string, embedding: number[]): Promise<void> {
  const cacheKey = getEmbeddingCacheKey(text);

  // In-memory cache
  embeddingCache.set(cacheKey, {
    embedding,
    timestamp: Date.now(),
  });

  // Redis cache (non-blocking)
  try {
    const redis = await getRedisClient();
    if (redis) {
      const redisKey = `emb:${cacheKey}`;
      await redis.setex(redisKey, REDIS_CACHE_TTL_SECONDS, JSON.stringify(embedding));
    }
  } catch (error) {
    // Silently fail Redis write - in-memory cache is sufficient
  }
}

/**
 * Synchronous in-memory cache (for backward compatibility)
 */
function cacheEmbedding(text: string, embedding: number[]): void {
  const cacheKey = getEmbeddingCacheKey(text);
  embeddingCache.set(cacheKey, {
    embedding,
    timestamp: Date.now(),
  });
  // Fire and forget Redis cache
  cacheEmbeddingAsync(text, embedding).catch(() => {});
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): number {
  const now = Date.now();
  let cleared = 0;

  for (const [key, value] of embeddingCache.entries()) {
    if (now - value.timestamp >= CACHE_TTL_MS) {
      embeddingCache.delete(key);
      cleared++;
    }
  }

  return cleared;
}

/**
 * Clear all cache entries
 */
export function clearCache(): void {
  embeddingCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; oldestEntry: number | null } {
  let oldestTimestamp: number | null = null;

  for (const value of embeddingCache.values()) {
    if (oldestTimestamp === null || value.timestamp < oldestTimestamp) {
      oldestTimestamp = value.timestamp;
    }
  }

  return {
    size: embeddingCache.size,
    oldestEntry: oldestTimestamp ? Date.now() - oldestTimestamp : null,
  };
}

/**
 * Check if an error is a rate limit error (HTTP 429)
 */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("429") || error.message.toLowerCase().includes("rate limit");
  }
  return false;
}

/**
 * Execute a function with exponential backoff for rate limit errors
 */
async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelayMs: number = BASE_DELAY_MS
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Only retry on rate limit errors
      if (!isRateLimitError(error)) throw error;

      // Don't delay after the last attempt
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      }
    }
  }

  throw lastError!;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Generate embedding for a single text using Voyage AI
 */
export async function generateEmbedding(
  text: string,
  options?: {
    skipCache?: boolean;
    skipRateLimit?: boolean;
  }
): Promise<EmbeddingResult | null> {
  const { skipCache = false, skipRateLimit = false } = options ?? {};

  // Check API key
  if (!process.env.VOYAGE_API_KEY) {
    console.error("[Embedding Service] VOYAGE_API_KEY is not configured");
    return null;
  }

  // Check cache first
  if (!skipCache) {
    const cached = getCachedEmbedding(text);
    if (cached) {
      return {
        embedding: cached,
        model: VOYAGE_MODEL,
      };
    }
  }

  // Apply rate limiting
  if (!skipRateLimit) {
    await waitForRateLimit();
  }

  try {
    const makeRequest = async (): Promise<EmbeddingResult> => {
      // Set up timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(VOYAGE_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: text,
          model: VOYAGE_MODEL,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Voyage API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const embedding = data.data[0].embedding;

      return {
        embedding,
        model: VOYAGE_MODEL,
        usage: data.usage
          ? { totalTokens: data.usage.total_tokens }
          : undefined,
      };
    };

    const result = await withExponentialBackoff(makeRequest);

    // Cache the result
    if (!skipCache) {
      cacheEmbedding(text, result.embedding);
    }

    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[Embedding Service] Request timed out");
      return null;
    }
    console.error("[Embedding Service] Error generating embedding:", error);
    return null;
  }
}

/**
 * Generate embeddings for multiple texts in a batch
 * More efficient than calling generateEmbedding multiple times
 */
export async function generateBatchEmbeddings(
  texts: string[],
  options?: {
    skipCache?: boolean;
  }
): Promise<BatchEmbeddingResult | null> {
  const { skipCache = false } = options ?? {};

  if (!process.env.VOYAGE_API_KEY) {
    console.error("[Embedding Service] VOYAGE_API_KEY is not configured");
    return null;
  }

  if (texts.length === 0) {
    return { embeddings: [], model: VOYAGE_MODEL };
  }

  // Check cache for all texts
  const results: (number[] | null)[] = [];
  const uncachedTexts: string[] = [];
  const uncachedIndices: number[] = [];

  if (!skipCache) {
    for (let i = 0; i < texts.length; i++) {
      const cached = getCachedEmbedding(texts[i]);
      if (cached) {
        results[i] = cached;
      } else {
        results[i] = null;
        uncachedTexts.push(texts[i]);
        uncachedIndices.push(i);
      }
    }

    // If all cached, return immediately
    if (uncachedTexts.length === 0) {
      return {
        embeddings: results as number[][],
        model: VOYAGE_MODEL,
      };
    }
  } else {
    // No cache - all texts need embedding
    for (let i = 0; i < texts.length; i++) {
      results[i] = null;
      uncachedTexts.push(texts[i]);
      uncachedIndices.push(i);
    }
  }


  // Apply rate limiting
  await waitForRateLimit();

  try {
    interface BatchApiResponse {
      data: Array<{ embedding: number[] }>;
      usage?: { total_tokens: number };
    }

    const makeRequest = async (): Promise<BatchApiResponse> => {
      // Set up timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(VOYAGE_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: uncachedTexts,
          model: VOYAGE_MODEL,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Voyage API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    };

    const data = await withExponentialBackoff(makeRequest);

    // Map results back to original indices
    for (let i = 0; i < data.data.length; i++) {
      const embedding = data.data[i].embedding;
      const originalIndex = uncachedIndices[i];
      results[originalIndex] = embedding;

      // Cache each result
      if (!skipCache) {
        cacheEmbedding(uncachedTexts[i], embedding);
      }
    }

    return {
      embeddings: results as number[][],
      model: VOYAGE_MODEL,
      usage: data.usage
        ? { totalTokens: data.usage.total_tokens }
        : undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[Embedding Service] Batch request timed out");
      return null;
    }
    console.error("[Embedding Service] Error generating batch embeddings:", error);
    return null;
  }
}

/**
 * Health check for the embedding service
 */
export async function checkEmbeddingServiceHealth(): Promise<EmbeddingServiceHealth> {
  const apiKeyConfigured = !!process.env.VOYAGE_API_KEY;

  if (!apiKeyConfigured) {
    return {
      healthy: false,
      provider: "voyage",
      model: VOYAGE_MODEL,
      apiKeyConfigured: false,
      error: "VOYAGE_API_KEY is not configured",
    };
  }

  try {
    // Try a minimal embedding request
    const result = await generateEmbedding("health check", {
      skipCache: true,
      skipRateLimit: true,
    });

    if (result && result.embedding.length === 1536) {
      return {
        healthy: true,
        provider: "voyage",
        model: VOYAGE_MODEL,
        apiKeyConfigured: true,
      };
    }

    return {
      healthy: false,
      provider: "voyage",
      model: VOYAGE_MODEL,
      apiKeyConfigured: true,
      error: "Unexpected embedding dimensions or null result",
    };
  } catch (error) {
    return {
      healthy: false,
      provider: "voyage",
      model: VOYAGE_MODEL,
      apiKeyConfigured: true,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

const embeddingService = {
  generateEmbedding,
  generateBatchEmbeddings,
  checkHealth: checkEmbeddingServiceHealth,
  clearCache,
  clearExpiredCache,
  getCacheStats,
};

export default embeddingService;
