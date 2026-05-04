import { readdirSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { TokenUsage } from "./types.js";

/**
 * Walk a directory tree and return every file path ending in `.jsonl`.
 * Avoids symlink loops by not following links.
 */
function collectJsonlFiles(root: string, out: string[] = [], depth = 0): string[] {
  if (depth > 6) return out; // guard against absurd nesting
  let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      collectJsonlFiles(full, out, depth + 1);
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      out.push(full);
    }
  }
  return out;
}

// Claude 4.x pricing (USD per 1M tokens). Kept in one place so it's easy to audit/update.
// Source: Anthropic pricing page as of this writing.
const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  "claude-opus-4": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 },
  "claude-opus-4-5": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 },
  "claude-opus-4-6": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 },
  "claude-opus-4-7": { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 },
  "claude-sonnet-4": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 },
  "claude-sonnet-4-5": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.10 },
};

function rateFor(model: string): typeof PRICING_USD_PER_MTOK[string] {
  // Strip a trailing date/variant like "-20251001" or "[1m]".
  const normalized = model.replace(/\[.*?\]/g, "").replace(/-\d{8}$/, "").replace(/-latest$/, "");
  if (PRICING_USD_PER_MTOK[normalized]) return PRICING_USD_PER_MTOK[normalized];
  // Family fallback so a model we haven't seen still produces a reasonable estimate.
  if (normalized.startsWith("claude-opus")) return PRICING_USD_PER_MTOK["claude-opus-4-7"];
  if (normalized.startsWith("claude-sonnet")) return PRICING_USD_PER_MTOK["claude-sonnet-4-6"];
  if (normalized.startsWith("claude-haiku")) return PRICING_USD_PER_MTOK["claude-haiku-4-5"];
  return PRICING_USD_PER_MTOK["claude-sonnet-4-6"];
}

interface UsageDelta {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Parse a Claude Code session JSONL file, accumulating usage from assistant
 * messages that arrived after `sessionStartedAt`.
 *
 * Each assistant message typically has a `message.usage` block with:
 *   input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens
 */
function accumulateFromFile(
  filePath: string,
  sessionStartedAtMs: number,
  model: string | null,
): { usage: UsageDelta; detectedModel: string | null } {
  const usage: UsageDelta = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };
  let detectedModel = model;

  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    return { usage, detectedModel };
  }

  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    let rec: Record<string, unknown>;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }

    // Time gate — skip anything before the session started
    const ts = typeof rec.timestamp === "string" ? Date.parse(rec.timestamp) : NaN;
    if (Number.isFinite(ts) && ts < sessionStartedAtMs) continue;

    const msg = rec.message as Record<string, unknown> | undefined;
    if (!msg || typeof msg !== "object") continue;
    if (!detectedModel && typeof msg.model === "string") detectedModel = msg.model;

    const u = msg.usage as UsageDelta | undefined;
    if (!u || typeof u !== "object") continue;

    usage.input_tokens! += u.input_tokens ?? 0;
    usage.output_tokens! += u.output_tokens ?? 0;
    usage.cache_creation_input_tokens! += u.cache_creation_input_tokens ?? 0;
    usage.cache_read_input_tokens! += u.cache_read_input_tokens ?? 0;
  }

  return { usage, detectedModel };
}

/**
 * Best-effort token usage extractor for a Claude Code session.
 *
 * Walks `~/.claude/projects/<hash>/*.jsonl`, picks files modified after the
 * session started, and sums usage across all assistant messages from that
 * point. Returns zeros if nothing usable is found — callers should treat
 * this as a non-fatal enrichment, not a guaranteed measurement.
 */
export function extractTokenUsage(sessionStartedAt: string): TokenUsage {
  const zero: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 };

  const startedAtMs = Date.parse(sessionStartedAt);
  if (!Number.isFinite(startedAtMs)) return zero;

  const projectsRoot = join(homedir(), ".claude", "projects");

  // Walk the full tree. Claude Code writes:
  //   ~/.claude/projects/<cwd-hash>/<session-uuid>.jsonl          ← main session
  //   ~/.claude/projects/<cwd-hash>/<session-uuid>/subagents/*.jsonl ← each subagent
  // Earlier version only read one directory level and missed every subagent — meaning
  // sessions that used Task/Agent subagents (most real work) reported zero tokens.
  const allFiles = collectJsonlFiles(projectsRoot);

  const agg: UsageDelta = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };
  let model: string | null = null;
  let scannedFiles = 0;
  let filesWithUsage = 0;

  for (const file of allFiles) {
    // Skip files last modified before the session started — they can't contribute.
    try {
      const s = statSync(file);
      if (s.mtimeMs < startedAtMs) continue;
    } catch {
      continue;
    }

    scannedFiles++;
    const before = agg.input_tokens! + agg.output_tokens! + agg.cache_creation_input_tokens! + agg.cache_read_input_tokens!;
    const { usage, detectedModel } = accumulateFromFile(file, startedAtMs, model);
    agg.input_tokens! += usage.input_tokens ?? 0;
    agg.output_tokens! += usage.output_tokens ?? 0;
    agg.cache_creation_input_tokens! += usage.cache_creation_input_tokens ?? 0;
    agg.cache_read_input_tokens! += usage.cache_read_input_tokens ?? 0;
    const after = agg.input_tokens! + agg.output_tokens! + agg.cache_creation_input_tokens! + agg.cache_read_input_tokens!;
    if (after > before) filesWithUsage++;
    if (!model && detectedModel) model = detectedModel;
  }

  // Leave a crumb in the CLI log so operators can tell extraction ran, found files,
  // and saw usage blocks. Zero-token sessions that scan zero files are a different
  // bug than zero-token sessions that scan 20 files with no usage matches.
  if (process.env.SPRINTIQ_CLI_DEBUG === "1" || scannedFiles === 0) {
    try {
      // eslint-disable-next-line no-console
      console.error(
        `[sprintiq:token-extractor] scanned=${allFiles.length} eligible=${scannedFiles} withUsage=${filesWithUsage} ` +
        `model=${model ?? "unknown"} sessionStart=${sessionStartedAt}`
      );
    } catch {
      // Never let a log call break extraction
    }
  }

  const inputTokens = (agg.input_tokens ?? 0) + (agg.cache_creation_input_tokens ?? 0) + (agg.cache_read_input_tokens ?? 0);
  const outputTokens = agg.output_tokens ?? 0;
  const totalTokens = inputTokens + outputTokens;

  if (totalTokens === 0) return zero;

  const rate = rateFor(model ?? "claude-sonnet-4-6");
  const costUsd =
    ((agg.input_tokens ?? 0) / 1_000_000) * rate.input +
    ((agg.cache_creation_input_tokens ?? 0) / 1_000_000) * rate.cacheWrite +
    ((agg.cache_read_input_tokens ?? 0) / 1_000_000) * rate.cacheRead +
    (outputTokens / 1_000_000) * rate.output;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd: Math.round(costUsd * 10000) / 10000,
  };
}
