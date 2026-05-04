import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { log } from "./logger.js";
import type { ClaudeCodeReport } from "./monitor/types.js";

const REPORT_PATH = ".sprintiq/report.json";
const REPORT_POLL_MAX_MS = 5_000;
const REPORT_POLL_INTERVAL_MS = 500;

const VALID_STATUSES = new Set(["completed", "blocked", "needs_review"]);
const VALID_ISSUE_TYPES = new Set(["bug", "tech_debt", "followup"]);
const VALID_SEVERITIES = new Set(["low", "medium", "high", "critical"]);

/**
 * Reads and validates .sprintiq/report.json from the working directory.
 * Returns null on any failure — never throws.
 */
export async function readReport(workingDir: string): Promise<ClaudeCodeReport | null> {
  const filePath = join(workingDir, REPORT_PATH);

  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    // File doesn't exist — normal case, not a warning
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    log.warn(`Invalid JSON in ${REPORT_PATH} — skipping`);
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    log.warn(`${REPORT_PATH} is not an object — skipping`);
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  const report: ClaudeCodeReport = {};

  // status
  if (obj.status !== undefined) {
    if (typeof obj.status === "string" && VALID_STATUSES.has(obj.status)) {
      report.status = obj.status as ClaudeCodeReport["status"];
    } else {
      log.warn(`Invalid status in ${REPORT_PATH}: ${JSON.stringify(obj.status)}`);
    }
  }

  // summary
  if (obj.summary !== undefined) {
    if (typeof obj.summary === "string") {
      report.summary = obj.summary;
    }
  }

  // ac_results
  if (Array.isArray(obj.ac_results)) {
    report.ac_results = obj.ac_results
      .filter((item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null &&
        typeof (item as Record<string, unknown>).index === "number" &&
        typeof (item as Record<string, unknown>).met === "boolean"
      )
      .map((item) => ({
        index: item.index as number,
        met: item.met as boolean,
        ...(typeof item.evidence === "string" ? { evidence: item.evidence } : {}),
      }));
  }

  // issues
  if (Array.isArray(obj.issues)) {
    report.issues = obj.issues
      .filter((item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null &&
        typeof (item as Record<string, unknown>).type === "string" &&
        VALID_ISSUE_TYPES.has((item as Record<string, unknown>).type as string) &&
        typeof (item as Record<string, unknown>).title === "string"
      )
      .map((item) => ({
        type: item.type as 'bug' | 'tech_debt' | 'followup',
        title: item.title as string,
        ...(typeof item.description === "string" ? { description: item.description } : {}),
        ...(typeof item.severity === "string" && VALID_SEVERITIES.has(item.severity as string)
          ? { severity: item.severity as 'low' | 'medium' | 'high' | 'critical' }
          : {}),
        ...(typeof item.file_path === "string" ? { file_path: item.file_path } : {}),
        ...(typeof item.line_number === "number" ? { line_number: item.line_number } : {}),
        ...(typeof item.suggested_points === "number" ? { suggested_points: item.suggested_points } : {}),
      }));
  }

  return report;
}

/**
 * Polls for report.json existence up to maxWaitMs, then reads and validates it.
 * Claude Code writes this file asynchronously — it may not exist immediately
 * after the process exits.
 */
export async function waitForReport(workingDir: string): Promise<ClaudeCodeReport | null> {
  const filePath = join(workingDir, REPORT_PATH);
  const deadline = Date.now() + REPORT_POLL_MAX_MS;

  while (Date.now() < deadline) {
    if (existsSync(filePath)) {
      const report = await readReport(workingDir);
      if (report) return report;
      // File exists but couldn't be parsed — may still be writing, retry
    }
    await new Promise((resolve) => setTimeout(resolve, REPORT_POLL_INTERVAL_MS));
  }

  return null;
}
