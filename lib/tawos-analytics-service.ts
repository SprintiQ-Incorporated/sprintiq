/**
 * TAWOS Analytics Logging Service
 *
 * Lean OSS surface: only the live `tawos_retrieval_logs` writer survives. The
 * daily-stats aggregation pipeline (`tawos_retrieval_daily_stats` table, the
 * `aggregate-tawos-stats`/`tawos-health` cron routes, and the realtime/dashboard
 * helpers) was removed when the OSS reduction migration dropped that table.
 */

import { createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database-aliases";

// ============================================================================
// Types
// ============================================================================

export type TAWOSRetrievalLog =
  Database["public"]["Tables"]["tawos_retrieval_logs"]["Row"];
export type TAWOSRetrievalLogInsert =
  Database["public"]["Tables"]["tawos_retrieval_logs"]["Insert"];

export type FrameworkCategory =
  | "Auth"
  | "API"
  | "DB"
  | "UI"
  | "Security"
  | "Integration"
  | "Testing"
  | "DevOps"
  | "Analytics"
  | "Other";

export interface RetrievalChunk {
  id: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface LogRetrievalParams {
  workspaceId?: string;
  sessionId?: string;
  queryText: string;
  retrievalTier:
    | "success_patterns"
    | "story_templates"
    | "anti_patterns";
  thresholdUsed: number;
  chunks: RetrievalChunk[];
  generationSuccess: boolean;
  latencyMs: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map a string to a framework category based on keyword patterns
 */
function mapToFrameworkCategory(text: string): FrameworkCategory {
  const patterns: Record<FrameworkCategory, RegExp> = {
    Auth: /\b(auth|login|signin|sign-in|oauth|jwt|token|session|password|credential)\b/i,
    API: /\b(api|endpoint|rest|graphql|request|response|http|webhook|route)\b/i,
    DB: /\b(db|database|query|sql|nosql|migration|schema|index|postgres|mongo|redis)\b/i,
    UI: /\b(ui|component|button|form|modal|layout|responsive|frontend|react|vue|angular)\b/i,
    Security: /\b(security|encrypt|hash|xss|csrf|injection|vulnerability|sanitize|validate)\b/i,
    Integration: /\b(integration|connect|sync|import|export|third-party|external|webhook)\b/i,
    Testing: /\b(test|unit|integration|e2e|mock|coverage|jest|cypress|playwright)\b/i,
    DevOps: /\b(devops|deploy|ci\/cd|docker|kubernetes|pipeline|monitoring|infra)\b/i,
    Analytics: /\b(analytics|metric|tracking|dashboard|report|data|telemetry|logging)\b/i,
    Other: /./,
  };

  // Check patterns in order of specificity
  const orderedCategories: FrameworkCategory[] = [
    "Auth",
    "Security",
    "API",
    "DB",
    "UI",
    "Integration",
    "Testing",
    "DevOps",
    "Analytics",
  ];

  for (const category of orderedCategories) {
    if (patterns[category].test(text)) {
      return category;
    }
  }

  return "Other";
}

/**
 * Infer framework category from chunk metadata
 */
export function inferFrameworkCategory(
  metadata: Record<string, unknown>
): FrameworkCategory {
  // Check explicit fields first
  const framework = metadata.framework as string | undefined;
  const category = metadata.category as string | undefined;
  const domain = metadata.domain as string | undefined;

  const explicitValue = framework || category || domain;
  if (explicitValue) {
    const normalized = explicitValue.toLowerCase();
    return mapToFrameworkCategory(normalized);
  }

  // Check tags
  const tags = metadata.tags as string[] | undefined;
  if (tags && Array.isArray(tags)) {
    for (const tag of tags) {
      const fromTag = mapToFrameworkCategory(tag.toLowerCase());
      if (fromTag !== "Other") {
        return fromTag;
      }
    }
  }

  // Check title and description
  const title = (metadata.title as string) || "";
  const description = (metadata.description as string) || "";
  const combined = `${title} ${description}`.toLowerCase();

  return mapToFrameworkCategory(combined);
}

/**
 * Calculate similarity statistics from chunks
 */
function calculateSimilarityStats(chunks: RetrievalChunk[]): {
  avg: number | null;
  max: number | null;
  min: number | null;
} {
  if (chunks.length === 0) {
    return { avg: null, max: null, min: null };
  }

  const similarities = chunks.map((c) => c.similarity);
  const sum = similarities.reduce((a, b) => a + b, 0);

  return {
    avg: sum / similarities.length,
    max: Math.max(...similarities),
    min: Math.min(...similarities),
  };
}

/**
 * Build framework categories distribution from chunks
 */
function buildFrameworkCategories(
  chunks: RetrievalChunk[]
): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const chunk of chunks) {
    const category = inferFrameworkCategory(chunk.metadata);
    distribution[category] = (distribution[category] || 0) + 1;
  }

  return distribution;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Log a TAWOS retrieval operation. Non-blocking from callers — failures are
 * surfaced via console only and do not propagate.
 */
export async function logTAWOSRetrieval(
  params: LogRetrievalParams
): Promise<TAWOSRetrievalLog | null> {
  try {
    // Must use admin (service_role) client — this function is called from the
    // QStash worker which has no user session. RLS policy
    // `tawos_retrieval_logs_insert_authenticated` requires auth.uid(); only
    // `tawos_retrieval_logs_insert_service` (service_role) works in worker
    // context.
    const admin = createAdminClient();
    const similarityStats = calculateSimilarityStats(params.chunks);
    const frameworkCategories = buildFrameworkCategories(params.chunks);

    // Resolve workspace UUID — callers may pass short ID (route param) or UUID
    const rawWorkspaceId = params.workspaceId || null;
    let workspaceUUID = rawWorkspaceId;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (workspaceUUID && !uuidPattern.test(workspaceUUID)) {
      const { data: ws, error: lookupError } = await admin
        .from("workspaces")
        .select("id")
        .eq("workspace_id", workspaceUUID)
        .single();
      if (lookupError) {
        console.error("[TAWOS Analytics] Workspace short-ID lookup failed", {
          rawWorkspaceId,
          retrievalTier: params.retrievalTier,
          lookupError: lookupError.message,
          lookupCode: lookupError.code,
        });
      }
      workspaceUUID = ws?.id || null;
    }

    if (!workspaceUUID) {
      console.error("[TAWOS Analytics] Could not resolve workspace UUID — log row dropped", {
        rawWorkspaceId,
        rawType: typeof rawWorkspaceId,
        retrievalTier: params.retrievalTier,
        chunksRetrieved: params.chunks.length,
        generationSuccess: params.generationSuccess,
      });
      return null;
    }

    const logEntry: TAWOSRetrievalLogInsert = {
      workspace_id: workspaceUUID,
      session_id: params.sessionId || null,
      query_text: params.queryText,
      retrieval_tier: params.retrievalTier,
      threshold_used: params.thresholdUsed,
      chunks_retrieved: params.chunks.length,
      avg_similarity_score: similarityStats.avg,
      max_similarity_score: similarityStats.max,
      min_similarity_score: similarityStats.min,
      framework_categories: frameworkCategories,
      generation_success: params.generationSuccess,
      latency_ms: params.latencyMs,
    };

    const { data, error } = await admin
      .from("tawos_retrieval_logs")
      .insert(logEntry)
      .select()
      .single();

    if (error) {
      console.error("[TAWOS Analytics] Insert failed:", error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error("[TAWOS Analytics] Unexpected error:", err);
    return null;
  }
}
