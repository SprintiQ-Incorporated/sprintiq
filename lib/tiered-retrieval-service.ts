/**
 * Tiered Retrieval Service for RAG
 *
 * Implements tiered retrieval to ensure diverse framework coverage
 * in RAG results. This helps prevent framework bias where some
 * frameworks are over-represented while others are under-represented.
 *
 * Features:
 * - Minimum chunks per framework (configurable)
 * - Priority-based retrieval for success/anti-patterns
 * - Framework-aware scoring
 * - Cost optimization through smart caching
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/embedding-service";
import { logTAWOSRetrieval } from "./tawos-analytics-service";

// ============================================================================
// Error Types and Constants
// ============================================================================

/**
 * PostgreSQL error codes relevant to search operations
 */
const PG_ERROR_CODES = {
  STATEMENT_TIMEOUT: "57014",
  QUERY_CANCELED: "57014",
  LOCK_NOT_AVAILABLE: "55P03",
  DEADLOCK_DETECTED: "40P01",
} as const;

/**
 * Database timeout configuration (in milliseconds)
 * Supabase free tier has 3-8 second default timeout
 * We use a more aggressive timeout to fail fast and provide feedback
 */
const DB_TIMEOUT_MS = 8000; // 8 seconds

export interface TieredSearchError {
  type: "timeout" | "embedding_failed" | "database_error" | "unknown";
  message: string;
  code?: string;
  retryable: boolean;
}

/**
 * Check if an error is a PostgreSQL statement timeout (error 57014)
 */
function isTimeoutError(error: unknown): boolean {
  if (!error) return false;

  const errorStr = String(error);
  const errorObj = error as { code?: string; message?: string };

  return (
    errorObj.code === PG_ERROR_CODES.STATEMENT_TIMEOUT ||
    errorStr.includes("57014") ||
    errorStr.includes("statement timeout") ||
    errorStr.includes("canceling statement due to statement timeout") ||
    errorStr.includes("Query read timeout")
  );
}

/**
 * Parse database error into structured TieredSearchError
 */
function parseSearchError(error: unknown): TieredSearchError {
  if (isTimeoutError(error)) {
    return {
      type: "timeout",
      message: `Vector search timed out after ${DB_TIMEOUT_MS}ms. This may indicate missing HNSW index or high database load.`,
      code: PG_ERROR_CODES.STATEMENT_TIMEOUT,
      retryable: true,
    };
  }

  const errorObj = error as { code?: string; message?: string };

  if (errorObj.message?.includes("different vector dimensions")) {
    return {
      type: "database_error",
      message: "Vector dimension mismatch. Embeddings may need regeneration.",
      code: errorObj.code,
      retryable: false,
    };
  }

  return {
    type: "database_error",
    message: errorObj.message || String(error),
    code: errorObj.code,
    retryable: false,
  };
}

// ============================================================================
// Configuration
// ============================================================================

export interface TieredRetrievalConfig {
  // Total maximum chunks to retrieve
  maxTotalChunks: number;

  // Minimum chunks per framework category
  minChunksPerFramework: number;

  // Similarity threshold for retrieval
  similarityThreshold: number;

  // Priority boost for high-success patterns
  successPatternBoost: number;

  // Priority boost for anti-patterns (for risk detection)
  antiPatternBoost: number;

  // Framework categories to ensure coverage
  frameworks: string[];
}

/**
 * Tier similarity thresholds — single source of truth.
 *
 * These values are imported by the Anthropic prompt in story-actions.ts so the
 * LLM is always told the correct threshold for each tier. Do not duplicate
 * these numbers elsewhere; interpolate from here.
 *
 * Historical context in the inline comments on each tier function explains
 * why these are lower than the TAWOS corpus might suggest (cross-domain
 * queries score lower than in-corpus neighbors).
 */
export const TIER_THRESHOLDS = {
  SUCCESS_PATTERNS: 0.55,
  STORY_TEMPLATES: 0.5,
  ANTI_PATTERNS: 0.45,
} as const;

export const DEFAULT_CONFIG: TieredRetrievalConfig = {
  maxTotalChunks: 10,
  minChunksPerFramework: 1,
  similarityThreshold: 0.65, // Generic default for tieredSearch() callers that don't go through a named tier function
  successPatternBoost: 0.1,
  antiPatternBoost: 0.05,
  frameworks: [
    "authentication",
    "authorization",
    "api",
    "database",
    "ui",
    "performance",
    "security",
    "testing",
    "devops",
    "analytics",
  ],
};

// ============================================================================
// Types
// ============================================================================

export interface TieredSearchResult {
  id: string;
  similarity: number;
  boostedScore: number;
  framework: string | null;
  isSuccessPattern: boolean;
  isAntiPattern: boolean;
  metadata: {
    title?: string;
    description?: string;
    role?: string;
    want?: string;
    benefit?: string;
    acceptanceCriteria?: string[];
    storyPoints?: number;
    businessValue?: number;
    priority?: string;
    tags?: string[];
    completionRate?: number;
    successPattern?: string;
    antiPatterns?: string[];
    complexity?: string;
    [key: string]: unknown;
  };
}

export interface TieredRetrievalResult {
  results: TieredSearchResult[];
  frameworkCoverage: Map<string, number>;
  totalChunks: number;
  successPatternCount: number;
  antiPatternCount: number;
  averageSimilarity: number;
  retrievalTimeMs: number;
  /** Error information if search failed, undefined on success */
  error?: TieredSearchError;
}

// ============================================================================
// Framework Detection
// ============================================================================

/**
 * Detect which framework category a result belongs to
 */
function detectFramework(
  metadata: TieredSearchResult["metadata"],
  frameworks: string[]
): string | null {
  const tags = metadata.tags || [];
  const description = (metadata.description || "").toLowerCase();
  const title = (metadata.title || "").toLowerCase();

  // Check tags first (most reliable)
  for (const tag of tags) {
    const normalizedTag = tag.toLowerCase();
    for (const framework of frameworks) {
      if (normalizedTag.includes(framework) || framework.includes(normalizedTag)) {
        return framework;
      }
    }
  }

  // Check title and description
  const combined = `${title} ${description}`;
  for (const framework of frameworks) {
    if (combined.includes(framework)) {
      return framework;
    }
  }

  // Framework-specific keyword detection
  const keywordMap: Record<string, string[]> = {
    authentication: ["login", "signin", "sign-in", "oauth", "jwt", "token", "session"],
    authorization: ["permission", "role", "access", "rbac", "acl"],
    api: ["endpoint", "rest", "graphql", "request", "response", "http"],
    database: ["query", "sql", "nosql", "migration", "schema", "index"],
    ui: ["component", "button", "form", "modal", "layout", "responsive"],
    performance: ["optimize", "cache", "lazy", "speed", "latency"],
    security: ["encrypt", "hash", "xss", "csrf", "injection", "vulnerability"],
    testing: ["test", "unit", "integration", "e2e", "mock", "coverage"],
    devops: ["deploy", "ci/cd", "docker", "kubernetes", "pipeline", "monitoring"],
    analytics: ["metric", "tracking", "dashboard", "report", "data"],
  };

  for (const [framework, keywords] of Object.entries(keywordMap)) {
    for (const keyword of keywords) {
      if (combined.includes(keyword)) {
        return framework;
      }
    }
  }

  return null;
}

/**
 * Check if result represents a success pattern
 */
function isSuccessPattern(metadata: TieredSearchResult["metadata"]): boolean {
  const completionRate = metadata.completionRate || 0;
  const hasSuccessPattern = !!metadata.successPattern;

  return completionRate >= 0.8 || hasSuccessPattern;
}

/**
 * Check if result contains anti-patterns
 */
function hasAntiPatterns(metadata: TieredSearchResult["metadata"]): boolean {
  const antiPatterns = metadata.antiPatterns || [];
  const completionRate = metadata.completionRate || 1;

  return antiPatterns.length > 0 || completionRate < 0.6;
}

// ============================================================================
// Tiered Retrieval Implementation
// ============================================================================

/**
 * Perform tiered retrieval with framework-aware scoring
 */
export async function tieredSearch(
  query: string,
  config: Partial<TieredRetrievalConfig> = {}
): Promise<TieredRetrievalResult> {
  const startTime = Date.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Generate embedding for query
  const embeddingResult = await generateEmbedding(query);
  if (!embeddingResult) {
    console.error("[TAWOS Search Error] Embedding generation returned null — check VOYAGE_API_KEY, Voyage API status, timeouts, or rate limits", {
      queryLength: query.length,
      elapsedMs: Date.now() - startTime,
      voyageKeyConfigured: !!process.env.VOYAGE_API_KEY,
    });
    return {
      results: [],
      frameworkCoverage: new Map(),
      totalChunks: 0,
      successPatternCount: 0,
      antiPatternCount: 0,
      averageSimilarity: 0,
      retrievalTimeMs: Date.now() - startTime,
      error: {
        type: "embedding_failed",
        message: "Failed to generate embedding for search query. Check Voyage AI service status.",
        retryable: true,
      },
    };
  }

  // tawos_user_stories has RLS with a SELECT policy gated TO authenticated and
  // an ALL policy gated TO service_role. tieredSearch() is invoked from the
  // QStash heavy-queue worker callback (/api/workers/heavy), which has no user
  // cookies in scope — so a user-context client falls back to anon, which
  // matches no policy and gets denied (RLS default: deny when no policy
  // applies). That denial is why match_documents has returned zero chunks for
  // every story-generation call since 2026-02-23.
  //
  // Corpus is global reference data with no tenant scoping; service_role is
  // the correct boundary here.
  const supabase = createAdminClient();

  // Fetch 1.5x results to allow for framework balancing without excessive overhead
  // Reduced from 3x to improve query performance and prevent timeouts
  const fetchCount = Math.ceil(cfg.maxTotalChunks * 1.5);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- match_documents RPC not in generated types
  const { data: matches, error } = await (supabase.rpc as (fn: string, params: Record<string, unknown>) => any)("match_documents", {
    query_embedding: embeddingResult.embedding,
    match_threshold: cfg.similarityThreshold,
    match_count: fetchCount,
    filter: {},
  });

  if (error || !matches) {
    const searchError = parseSearchError(error);

    // Log with structured information for monitoring
    console.error("[TAWOS Search Error]", {
      errorType: searchError.type,
      errorCode: searchError.code,
      message: searchError.message,
      retryable: searchError.retryable,
      queryLength: query.length,
      threshold: cfg.similarityThreshold,
      fetchCount,
      elapsedMs: Date.now() - startTime,
    });

    // Specific warning for timeout errors - critical for monitoring
    if (searchError.type === "timeout") {
    }

    return {
      results: [],
      frameworkCoverage: new Map(),
      totalChunks: 0,
      successPatternCount: 0,
      antiPatternCount: 0,
      averageSimilarity: 0,
      retrievalTimeMs: Date.now() - startTime,
      error: searchError,
    };
  }

  // Process and score results
  const processedResults: TieredSearchResult[] = matches.map((match: { id: string; similarity: number; metadata: TieredSearchResult["metadata"] }) => {
    const framework = detectFramework(match.metadata, cfg.frameworks);
    const successPattern = isSuccessPattern(match.metadata);
    const antiPattern = hasAntiPatterns(match.metadata);

    // Calculate boosted score
    let boostedScore = match.similarity;
    if (successPattern) {
      boostedScore += cfg.successPatternBoost;
    }
    if (antiPattern) {
      boostedScore += cfg.antiPatternBoost; // We want to surface anti-patterns for risk detection
    }

    return {
      id: match.id,
      similarity: match.similarity,
      boostedScore,
      framework,
      isSuccessPattern: successPattern,
      isAntiPattern: antiPattern,
      metadata: match.metadata,
    };
  });

  // Apply tiered selection
  const selectedResults = applyTieredSelection(processedResults, cfg);

  // Calculate coverage statistics
  const frameworkCoverage = new Map<string, number>();
  for (const result of selectedResults) {
    if (result.framework) {
      const count = frameworkCoverage.get(result.framework) || 0;
      frameworkCoverage.set(result.framework, count + 1);
    }
  }

  const successPatternCount = selectedResults.filter((r) => r.isSuccessPattern).length;
  const antiPatternCount = selectedResults.filter((r) => r.isAntiPattern).length;
  const averageSimilarity =
    selectedResults.length > 0
      ? selectedResults.reduce((sum, r) => sum + r.similarity, 0) / selectedResults.length
      : 0;

  return {
    results: selectedResults,
    frameworkCoverage,
    totalChunks: selectedResults.length,
    successPatternCount,
    antiPatternCount,
    averageSimilarity,
    retrievalTimeMs: Date.now() - startTime,
  };
}

/**
 * Apply tiered selection algorithm
 * Ensures minimum representation from each framework while prioritizing relevance
 */
function applyTieredSelection(
  results: TieredSearchResult[],
  config: TieredRetrievalConfig
): TieredSearchResult[] {
  const selected: TieredSearchResult[] = [];
  const frameworkCounts = new Map<string, number>();

  // Initialize framework counts
  for (const framework of config.frameworks) {
    frameworkCounts.set(framework, 0);
  }

  // Group results by framework
  const byFramework = new Map<string, TieredSearchResult[]>();
  const noFramework: TieredSearchResult[] = [];

  for (const result of results) {
    if (result.framework) {
      const group = byFramework.get(result.framework) || [];
      group.push(result);
      byFramework.set(result.framework, group);
    } else {
      noFramework.push(result);
    }
  }

  // Sort each group by boosted score
  for (const [, group] of byFramework) {
    group.sort((a, b) => b.boostedScore - a.boostedScore);
  }
  noFramework.sort((a, b) => b.boostedScore - a.boostedScore);

  // Phase 1: Ensure minimum coverage per framework
  for (const framework of config.frameworks) {
    const group = byFramework.get(framework) || [];
    const toAdd = Math.min(config.minChunksPerFramework, group.length);

    for (let i = 0; i < toAdd; i++) {
      if (selected.length >= config.maxTotalChunks) break;
      selected.push(group[i]);
      frameworkCounts.set(framework, (frameworkCounts.get(framework) || 0) + 1);
    }
  }

  // Phase 2: Fill remaining slots with highest scoring results
  const selectedIds = new Set(selected.map((r) => r.id));

  // Combine all remaining results
  const remaining = [
    ...results.filter((r) => !selectedIds.has(r.id)),
  ].sort((a, b) => b.boostedScore - a.boostedScore);

  for (const result of remaining) {
    if (selected.length >= config.maxTotalChunks) break;
    selected.push(result);
  }

  // Final sort by relevance
  selected.sort((a, b) => b.boostedScore - a.boostedScore);

  return selected;
}

// ============================================================================
// High-Precision Retrieval for Success Patterns
// ============================================================================

/**
 * Retrieve high-precision success patterns
 * Uses stricter thresholds for quality-critical use cases
 *
 * @param query - The search query text
 * @param maxResults - Maximum number of results to return (default: 5)
 * @param workspaceId - Optional workspace ID for analytics tracking
 *
 * @remarks
 * Analytics logging is non-blocking and won't affect retrieval performance.
 * Retrieval metrics are stored in the tawos_retrieval_logs table.
 */
export async function getHighPrecisionSuccessPatterns(
  query: string,
  maxResults: number = 5,
  workspaceId?: string
): Promise<TieredRetrievalResult> {
  const startTime = performance.now();

  const result = await tieredSearch(query, {
    maxTotalChunks: maxResults,
    // Cross-domain feature descriptions vs TAWOS corpus (short INVEST stories)
    // score lower than in-corpus neighbors (~0.94). 0.55 surfaces relevant matches
    // while still excluding noise. Was 0.75 — produced zero matches in prod.
    similarityThreshold: TIER_THRESHOLDS.SUCCESS_PATTERNS,
    successPatternBoost: 0.15,
    antiPatternBoost: 0,
    minChunksPerFramework: 0,
  });

  // Non-blocking analytics logging
  const latencyMs = Math.round(performance.now() - startTime);
  logTAWOSRetrieval({
    workspaceId,
    queryText: query,
    retrievalTier: "success_patterns",
    thresholdUsed: TIER_THRESHOLDS.SUCCESS_PATTERNS,
    chunks: result.results.map((r) => ({
      id: r.id,
      similarity: r.similarity,
      metadata: r.metadata,
    })),
    generationSuccess: result.results.length > 0,
    latencyMs,
  }).catch((err) => console.warn("[TAWOS] Retrieval log failed:", err instanceof Error ? err.message : err));

  return result;
}

/**
 * Retrieve anti-patterns and risks
 * Optimized for detecting potential issues
 *
 * @param query - The search query text
 * @param maxResults - Maximum number of results to return (default: 10)
 * @param workspaceId - Optional workspace ID for analytics tracking
 *
 * @remarks
 * Analytics logging is non-blocking and won't affect retrieval performance.
 * Retrieval metrics are stored in the tawos_retrieval_logs table.
 */
export async function getAntiPatternsAndRisks(
  query: string,
  maxResults: number = 10,
  workspaceId?: string
): Promise<TieredRetrievalResult> {
  const startTime = performance.now();

  const result = await tieredSearch(query, {
    maxTotalChunks: maxResults,
    // Broadest tier — catch potential risks even when only tangentially related.
    // Was 0.60 — produced zero matches for cross-domain queries.
    similarityThreshold: TIER_THRESHOLDS.ANTI_PATTERNS,
    successPatternBoost: 0,
    antiPatternBoost: 0.2,
    minChunksPerFramework: 0,
  });

  // Non-blocking analytics logging
  const latencyMs = Math.round(performance.now() - startTime);
  logTAWOSRetrieval({
    workspaceId,
    queryText: query,
    retrievalTier: "anti_patterns",
    thresholdUsed: TIER_THRESHOLDS.ANTI_PATTERNS,
    chunks: result.results.map((r) => ({
      id: r.id,
      similarity: r.similarity,
      metadata: r.metadata,
    })),
    generationSuccess: result.results.length > 0,
    latencyMs,
  }).catch((err) => console.warn("[TAWOS] Retrieval log failed:", err instanceof Error ? err.message : err));

  return result;
}

/**
 * Balanced retrieval for general story generation
 * Ensures diverse framework coverage
 *
 * @param query - The search query text
 * @param maxResults - Maximum number of results to return (default: 10)
 * @param workspaceId - Optional workspace ID for analytics tracking
 *
 * @remarks
 * Analytics logging is non-blocking and won't affect retrieval performance.
 * Retrieval metrics are stored in the tawos_retrieval_logs table.
 */
export async function getBalancedRetrieval(
  query: string,
  maxResults: number = 10,
  workspaceId?: string
): Promise<TieredRetrievalResult> {
  const startTime = performance.now();

  const result = await tieredSearch(query, {
    maxTotalChunks: maxResults,
    // Middle tier for balanced recall. Was 0.65 — produced zero matches.
    similarityThreshold: TIER_THRESHOLDS.STORY_TEMPLATES,
    successPatternBoost: 0.1,
    antiPatternBoost: 0.05,
    minChunksPerFramework: 1,
  });

  // Non-blocking analytics logging
  const latencyMs = Math.round(performance.now() - startTime);
  logTAWOSRetrieval({
    workspaceId,
    queryText: query,
    retrievalTier: "story_templates",
    thresholdUsed: TIER_THRESHOLDS.STORY_TEMPLATES,
    chunks: result.results.map((r) => ({
      id: r.id,
      similarity: r.similarity,
      metadata: r.metadata,
    })),
    generationSuccess: result.results.length > 0,
    latencyMs,
  }).catch((err) => console.warn("[TAWOS] Retrieval log failed:", err instanceof Error ? err.message : err));

  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Analyze retrieval quality for a query
 */
export async function analyzeRetrievalQuality(
  query: string
): Promise<{
  standardRetrieval: TieredRetrievalResult;
  tieredRetrieval: TieredRetrievalResult;
  comparison: {
    frameworkCoverageImprovement: number;
    similarityDrop: number;
    successPatternImprovement: number;
    recommendation: string;
  };
}> {
  // Standard retrieval (current approach)
  const standardRetrieval = await tieredSearch(query, {
    maxTotalChunks: 10,
    minChunksPerFramework: 0, // No framework enforcement
    similarityThreshold: 0.7,
    successPatternBoost: 0,
    antiPatternBoost: 0,
  });

  // Tiered retrieval (recommended approach)
  const tieredRetrieval = await getBalancedRetrieval(query, 10);

  // Compare results
  const standardCoverage = standardRetrieval.frameworkCoverage.size;
  const tieredCoverage = tieredRetrieval.frameworkCoverage.size;
  const coverageImprovement =
    standardCoverage > 0
      ? ((tieredCoverage - standardCoverage) / standardCoverage) * 100
      : tieredCoverage > 0
        ? 100
        : 0;

  const similarityDrop =
    standardRetrieval.averageSimilarity - tieredRetrieval.averageSimilarity;

  const successPatternImprovement =
    tieredRetrieval.successPatternCount - standardRetrieval.successPatternCount;

  let recommendation = "";
  if (coverageImprovement > 20 && similarityDrop < 0.05) {
    recommendation =
      "Tiered retrieval recommended: Significant coverage improvement with minimal similarity impact";
  } else if (coverageImprovement > 0 && similarityDrop < 0.1) {
    recommendation =
      "Tiered retrieval may help: Moderate coverage improvement with acceptable similarity trade-off";
  } else {
    recommendation =
      "Standard retrieval sufficient: Framework coverage is already good or similarity impact too high";
  }

  return {
    standardRetrieval,
    tieredRetrieval,
    comparison: {
      frameworkCoverageImprovement: coverageImprovement,
      similarityDrop,
      successPatternImprovement,
      recommendation,
    },
  };
}

// ============================================================================
// Export
// ============================================================================

const tieredRetrievalService = {
  tieredSearch,
  getHighPrecisionSuccessPatterns,
  getAntiPatternsAndRisks,
  getBalancedRetrieval,
  analyzeRetrievalQuality,
  DEFAULT_CONFIG,
};

export default tieredRetrievalService;
