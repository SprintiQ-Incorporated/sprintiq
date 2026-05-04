/**
 * TAWOS retrieval canary.
 *
 * Daily-cron sentinel that catches the failure mode that hid for two months:
 * silent zero-row retrieval. Embeds a rotation of fixed seed queries that
 * span different lexical territories of the corpus, calls match_documents
 * directly with threshold=0 (so we measure raw HNSW recall, not threshold-
 * filtered), and logs an alert if any seed:
 *   - returns < MIN_CHUNKS rows  (HNSW returning almost nothing — corpus,
 *                                 RLS, or index pathology)
 *   - returns avg similarity < MIN_AVG_SIM  (neighbors exist but are
 *                                            unrepresentative)
 *
 * Why a rotation: a single seed query lives in one lexical neighborhood and
 * may be robust to partial corpus or index corruption. Five seeds across
 * different territories (bug, feature, infra, security, UI) close that
 * blind spot — if any one goes silent, alarm fires.
 *
 * THRESHOLDS ARE FIRST-GUESS. The < 3 chunks and < 0.6 avg similarity floors
 * are reasonable starting points but have not been calibrated against a
 * healthy-state baseline. After one week of canary data, retune to:
 *   chunks   < (healthy_mean / 2)
 *   avg_sim  < (healthy_mean - 2σ)
 * Until then, alerts may include normal-day variance noise.
 *
 * Auth: Vercel cron header or Bearer CRON_SECRET (matches sibling crons).
 * Alerting: logs to stderr (Phase 3 OSS reduction removed Slack delivery).
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "@/lib/embedding-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Five seeds across distinct lexical territories. Stable input set =
// stable baseline. If you change the list, treat the historical metrics
// as not comparable and reset the empirical baseline.
const SEED_QUERIES = [
  // Bug-fix style — JIRA-dominant in the corpus
  "fix bug in JIRA workflow that causes performance issue when reindexing project",
  // Feature style — product capability
  "add ability to export sprint backlog as PDF report with progress charts",
  // Infrastructure style — ops / reliability
  "monitor service health and page on-call when error rate exceeds threshold",
  // Security style — auth / RBAC
  "enforce role-based access control on workspace member invitations",
  // UI style — user-facing interaction
  "display read receipts and unread badge on conversation threads",
];

const MIN_CHUNKS = 3;
const MIN_AVG_SIM = 0.6;
const MATCH_COUNT = 10;

interface SeedResult {
  query: string;
  chunksRetrieved: number;
  avgSimilarity: number | null;
  topSimilarity: number | null;
  bottomSimilarity: number | null;
  alarms: string[];
  error?: string;
}

interface CanaryReport {
  ok: boolean;
  totalAlarms: number;
  seeds: SeedResult[];
  latencyMs: number;
  timestamp: string;
}

function logCanaryAlert(report: CanaryReport): void {
  console.error("[tawos-canary] ALERT:", JSON.stringify(report));
}

async function probeOneSeed(
  admin: ReturnType<typeof createAdminClient>,
  query: string
): Promise<SeedResult> {
  const embeddingResult = await generateEmbedding(query, { skipCache: true });
  if (!embeddingResult || !Array.isArray(embeddingResult.embedding)) {
    return {
      query,
      chunksRetrieved: 0,
      avgSimilarity: null,
      topSimilarity: null,
      bottomSimilarity: null,
      alarms: ["embedding_failed"],
      error: "Voyage embedding generation returned null",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: matches, error } = await (admin.rpc as any)("match_documents", {
    query_embedding: embeddingResult.embedding,
    match_threshold: 0,
    match_count: MATCH_COUNT,
    filter: {},
  });

  if (error) {
    return {
      query,
      chunksRetrieved: 0,
      avgSimilarity: null,
      topSimilarity: null,
      bottomSimilarity: null,
      alarms: ["rpc_error"],
      error: error.message,
    };
  }

  const sims = ((matches ?? []) as { similarity: number }[]).map((m) => m.similarity);
  const chunksRetrieved = sims.length;
  const avgSimilarity = sims.length ? sims.reduce((a, b) => a + b, 0) / sims.length : null;
  const topSimilarity = sims.length ? Math.max(...sims) : null;
  const bottomSimilarity = sims.length ? Math.min(...sims) : null;

  const alarms: string[] = [];
  if (chunksRetrieved < MIN_CHUNKS) alarms.push("chunks_below_floor");
  if (avgSimilarity !== null && avgSimilarity < MIN_AVG_SIM) alarms.push("avg_sim_below_floor");

  return {
    query,
    chunksRetrieved,
    avgSimilarity,
    topSimilarity,
    bottomSimilarity,
    alarms,
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const isValidBearer = cronSecret && authHeader === `Bearer ${cronSecret}`;
  if (!isVercelCron && !isValidBearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const admin = createAdminClient();

  const seedResults = await Promise.all(
    SEED_QUERIES.map((q) => probeOneSeed(admin, q))
  );

  const totalAlarms = seedResults.reduce((sum, s) => sum + s.alarms.length, 0);

  const report: CanaryReport = {
    ok: totalAlarms === 0,
    totalAlarms,
    seeds: seedResults,
    latencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  };

  if (totalAlarms > 0) {
    logCanaryAlert(report);
  }

  return NextResponse.json(report);
}
