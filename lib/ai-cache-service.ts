/**
 * AI Response Caching Service
 *
 * Provides caching for AI/LLM API responses to reduce redundant API calls
 * and improve response times for similar queries.
 *
 * Features:
 * - In-memory LRU cache with configurable size
 * - Upstash Redis persistent cache for cross-instance sharing
 * - Content-hash based cache keys for semantic matching
 * - TTL-based expiration
 * - Cache statistics and monitoring
 * - Automatic fallback from Redis to in-memory
 */

import { createHash } from "crypto";

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
    const isProduction = process.env.NODE_ENV === 'production' ||
                        process.env.VERCEL_ENV === 'production';

    if (isProduction) {
    } else {
    }
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
// Configuration
// ============================================================================

const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_MAX_CACHE_SIZE = 500; // Maximum number of cached responses
const STORY_GENERATION_TTL_MS = 60 * 60 * 1000; // 1 hour for story generation
const DEPENDENCY_ANALYSIS_TTL_MS = 30 * 60 * 1000; // 30 minutes for dependencies
const SPRINT_GOAL_TTL_MS = 60 * 60 * 1000; // 1 hour for sprint goals

// Cache key prefixes for different operation types
export const CACHE_PREFIXES = {
  STORY_GENERATION: "story_gen:",
  DEPENDENCY_ANALYSIS: "dep_analysis:",
  SPRINT_GOAL: "sprint_goal:",
  PRIORITY_RECOMMENDATION: "priority_rec:",
  TEAM_OPTIMIZATION: "team_opt:",
  GENERIC: "ai_generic:",
} as const;

export type CachePrefix = (typeof CACHE_PREFIXES)[keyof typeof CACHE_PREFIXES];

// ============================================================================
// Types
// ============================================================================

export interface CachedAIResponse {
  text: string;
  provider: string;
  model: string;
  timestamp: number;
  ttl: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  metadata?: Record<string, unknown>;
}

interface CacheEntry {
  response: CachedAIResponse;
  lastAccessed: number;
}

export interface AICacheOptions {
  prefix: CachePrefix;
  ttl?: number;
  skipCache?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AICacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  oldestEntry: number | null;
  newestEntry: number | null;
  memoryEstimate: string;
}

// ============================================================================
// In-Memory LRU Cache
// ============================================================================

class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    // Delete existing entry to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, value);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  entries(): IterableIterator<[K, V]> {
    return this.cache.entries();
  }

  values(): IterableIterator<V> {
    return this.cache.values();
  }
}

// ============================================================================
// State
// ============================================================================

const aiResponseCache = new LRUCache<string, CacheEntry>(DEFAULT_MAX_CACHE_SIZE);
let cacheHits = 0;
let cacheMisses = 0;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a content-based hash key for caching
 * Uses SHA-256 hash of the normalized prompt content
 */
export function generateCacheKey(
  prefix: CachePrefix,
  prompt: string,
  additionalContext?: Record<string, unknown>
): string {
  const normalizedPrompt = prompt.toLowerCase().trim();
  const contextString = additionalContext
    ? JSON.stringify(additionalContext, Object.keys(additionalContext).sort())
    : "";

  const content = `${normalizedPrompt}|${contextString}`;
  const hash = createHash("sha256").update(content).digest("hex").substring(0, 16);

  return `${prefix}${hash}`;
}

/**
 * Determine TTL based on cache prefix
 */
function getTTLForPrefix(prefix: CachePrefix): number {
  switch (prefix) {
    case CACHE_PREFIXES.STORY_GENERATION:
      return STORY_GENERATION_TTL_MS;
    case CACHE_PREFIXES.DEPENDENCY_ANALYSIS:
      return DEPENDENCY_ANALYSIS_TTL_MS;
    case CACHE_PREFIXES.SPRINT_GOAL:
      return SPRINT_GOAL_TTL_MS;
    case CACHE_PREFIXES.PRIORITY_RECOMMENDATION:
      return DEFAULT_CACHE_TTL_MS;
    case CACHE_PREFIXES.TEAM_OPTIMIZATION:
      return DEFAULT_CACHE_TTL_MS;
    default:
      return DEFAULT_CACHE_TTL_MS;
  }
}

/**
 * Check if a cached entry is still valid
 */
function isEntryValid(entry: CacheEntry): boolean {
  return Date.now() - entry.response.timestamp < entry.response.ttl;
}

/**
 * Estimate memory usage of cache
 */
function estimateMemoryUsage(): string {
  let totalSize = 0;
  for (const entry of aiResponseCache.values()) {
    totalSize += entry.response.text.length * 2; // Approximate bytes for string
    totalSize += 200; // Metadata overhead estimate
  }

  if (totalSize < 1024) return `${totalSize} B`;
  if (totalSize < 1024 * 1024) return `${(totalSize / 1024).toFixed(2)} KB`;
  return `${(totalSize / (1024 * 1024)).toFixed(2)} MB`;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get cached AI response if available and valid
 * Checks in-memory cache first, then Redis
 */
export async function getCachedAIResponse(cacheKey: string): Promise<CachedAIResponse | null> {
  // Check in-memory cache first (faster)
  const entry = aiResponseCache.get(cacheKey);

  if (entry && isEntryValid(entry)) {
    entry.lastAccessed = Date.now();
    cacheHits++;
    return entry.response;
  }

  // Clean up invalid in-memory entry
  if (entry) {
    aiResponseCache.delete(cacheKey);
  }

  // Try Redis
  try {
    const redis = await getRedisClient();
    if (redis) {
      const redisKey = `aicache:${cacheKey}`;
      const cached = await redis.get(redisKey);

      if (cached) {
        const response = typeof cached === "string" ? JSON.parse(cached) : cached as CachedAIResponse;

        // Validate TTL
        if (Date.now() - response.timestamp < response.ttl) {
          // Populate in-memory cache for faster future access
          aiResponseCache.set(cacheKey, {
            response,
            lastAccessed: Date.now(),
          });
          cacheHits++;
          return response;
        }

        // Expired - delete from Redis
        await redis.del(redisKey);
      }
    }
  } catch (error) {
  }

  cacheMisses++;
  return null;
}

/**
 * Cache an AI response (in-memory and Redis)
 */
export async function cacheAIResponse(
  cacheKey: string,
  response: {
    text: string;
    provider: string;
    model: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
    };
  },
  options: AICacheOptions
): Promise<void> {
  const ttl = options.ttl || getTTLForPrefix(options.prefix);

  const cachedResponse: CachedAIResponse = {
    text: response.text,
    provider: response.provider,
    model: response.model,
    timestamp: Date.now(),
    ttl,
    usage: response.usage,
    metadata: options.metadata,
  };

  const entry: CacheEntry = {
    response: cachedResponse,
    lastAccessed: Date.now(),
  };

  // Store in in-memory cache
  aiResponseCache.set(cacheKey, entry);

  // Store in Redis for cross-instance sharing
  try {
    const redis = await getRedisClient();
    if (redis) {
      const redisKey = `aicache:${cacheKey}`;
      const ttlSeconds = Math.ceil(ttl / 1000);
      await redis.setex(redisKey, ttlSeconds, JSON.stringify(cachedResponse));
    }
  } catch (error) {
  }

}

/**
 * Wrapper function for AI completions with caching
 */
export async function withAICache<T extends { text: string; provider: string; model: string }>(
  cacheKey: string,
  options: AICacheOptions,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Skip cache if requested
  if (options.skipCache) {
    return fetchFn();
  }

  // Try cache first (now async)
  const cached = await getCachedAIResponse(cacheKey);
  if (cached) {
    return {
      text: cached.text,
      provider: cached.provider,
      model: cached.model,
      usage: cached.usage,
    } as unknown as T;
  }

  // Fetch fresh response
  const response = await fetchFn();

  // Cache the response (now async)
  await cacheAIResponse(cacheKey, response, options);

  return response;
}

/**
 * Clear expired entries from cache
 */
export function clearExpiredAICache(): number {
  let cleared = 0;
  const keysToDelete: string[] = [];

  for (const [key, entry] of aiResponseCache.entries()) {
    if (!isEntryValid(entry)) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    aiResponseCache.delete(key);
    cleared++;
  }

  if (cleared > 0) {
  }

  return cleared;
}

/**
 * Clear all cache entries
 */
export function clearAICache(): void {
  const size = aiResponseCache.size;
  aiResponseCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Invalidate cache entries by prefix
 */
export function invalidateCacheByPrefix(prefix: CachePrefix): number {
  let invalidated = 0;
  const keysToDelete: string[] = [];

  for (const [key] of aiResponseCache.entries()) {
    if (key.startsWith(prefix)) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    aiResponseCache.delete(key);
    invalidated++;
  }

  if (invalidated > 0) {
  }

  return invalidated;
}

/**
 * Get cache statistics
 */
export function getAICacheStats(): AICacheStats {
  let oldestTimestamp: number | null = null;
  let newestTimestamp: number | null = null;

  for (const entry of aiResponseCache.values()) {
    if (oldestTimestamp === null || entry.response.timestamp < oldestTimestamp) {
      oldestTimestamp = entry.response.timestamp;
    }
    if (newestTimestamp === null || entry.response.timestamp > newestTimestamp) {
      newestTimestamp = entry.response.timestamp;
    }
  }

  const totalRequests = cacheHits + cacheMisses;
  const hitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;

  return {
    size: aiResponseCache.size,
    maxSize: DEFAULT_MAX_CACHE_SIZE,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate,
    oldestEntry: oldestTimestamp ? Date.now() - oldestTimestamp : null,
    newestEntry: newestTimestamp ? Date.now() - newestTimestamp : null,
    memoryEstimate: estimateMemoryUsage(),
  };
}

// ============================================================================
// Specialized Caching Functions
// ============================================================================

/**
 * Create a cache key for story generation
 */
export function createStoryGenerationCacheKey(
  workspaceId: string,
  featureDescription: string,
  numberOfStories: number,
  complexity: string,
  personas?: string[]
): string {
  return generateCacheKey(CACHE_PREFIXES.STORY_GENERATION, featureDescription, {
    workspaceId,
    numberOfStories,
    complexity,
    personas: personas?.sort(),
  });
}

/**
 * Create a cache key for dependency analysis
 */
export function createDependencyAnalysisCacheKey(
  workspaceId: string,
  storyIds: string[]
): string {
  return generateCacheKey(CACHE_PREFIXES.DEPENDENCY_ANALYSIS, storyIds.sort().join(","), {
    workspaceId,
  });
}

/**
 * Create a cache key for sprint goal generation
 */
export function createSprintGoalCacheKey(
  workspaceId: string,
  sprintId: string,
  storyNames: string[]
): string {
  return generateCacheKey(CACHE_PREFIXES.SPRINT_GOAL, storyNames.sort().join("|"), {
    workspaceId,
    sprintId,
  });
}

/**
 * Create a cache key for priority recommendations
 */
export function createPriorityRecommendationCacheKey(
  workspaceId: string,
  taskId: string,
  taskDescription: string
): string {
  return generateCacheKey(CACHE_PREFIXES.PRIORITY_RECOMMENDATION, taskDescription, {
    workspaceId,
    taskId,
  });
}

// ============================================================================
// Auto-cleanup interval
// ============================================================================

// Run cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    clearExpiredAICache();
  }, 5 * 60 * 1000);
}

// ============================================================================
// Exports
// ============================================================================

const aiCacheService = {
  getCachedAIResponse,
  cacheAIResponse,
  withAICache,
  clearExpiredAICache,
  clearAICache,
  invalidateCacheByPrefix,
  getAICacheStats,
  generateCacheKey,
  createStoryGenerationCacheKey,
  createDependencyAnalysisCacheKey,
  createSprintGoalCacheKey,
  createPriorityRecommendationCacheKey,
  CACHE_PREFIXES,
};

export default aiCacheService;
