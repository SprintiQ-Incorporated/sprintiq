/**
 * Shared TypeScript types for Claude Code session metrics.
 * Mirrors CLI types from packages/cli/src/lib/monitor/types.ts
 */

import type { ClaudeCodeSession } from "@/lib/database-aliases";

// --- Mirrored CLI types ---

export interface FileChange {
  path: string;
  linesAdded: number;
  linesRemoved: number;
  isBinary: boolean;
}

export interface GitCommit {
  sha: string;
  message: string;
  timestamp: string;
  filesChanged: string[];
}

export interface TestRunResult {
  framework: string;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration?: number;
  timestamp: string;
  coveragePercent?: number;
}

export interface AggregatedTestResults {
  runs: TestRunResult[];
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  totalTests: number;
  detectedFrameworks: string[];
}

export interface SessionMetrics {
  sessionId: string;
  taskId: string;
  startedAt: string;
  durationMs: number;
  activeMs: number;
  idlePeriods: number;
  isIdle: boolean;
  files: {
    changed: number;
    totalLinesAdded: number;
    totalLinesRemoved: number;
    topFiles: FileChange[];
  };
  git: {
    commitCount: number;
    commits: GitCommit[];
  };
  tests: AggregatedTestResults;
}

// --- Extended types for completion reports ---

export interface DetectedIssue {
  type: "bug" | "security" | "performance" | "style" | "warning";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  file?: string;
  line?: number;
  linkedSubtaskId?: string;
}

export interface SessionReport extends SessionMetrics {
  issues?: DetectedIssue[];
  developerNotes?: string;
}

// --- Status types ---

export type SessionStatus =
  | "pending"
  | "active"
  | "completed"
  | "failed"
  | "abandoned"
  | "stopped";

export interface StatusBadgeConfig {
  label: string;
  color: string;
  bgColor: string;
  pulse: boolean;
  icon: "spinner" | "check" | "x" | "alert" | "clock" | "stop";
}

export const statusBadgeConfig: Record<SessionStatus, StatusBadgeConfig> = {
  pending: {
    label: "Pending",
    color: "text-yellow-600",
    bgColor: "bg-yellow-500/10",
    pulse: true,
    icon: "clock",
  },
  active: {
    label: "Active",
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    pulse: true,
    icon: "spinner",
  },
  completed: {
    label: "Completed",
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    pulse: false,
    icon: "check",
  },
  failed: {
    label: "Failed",
    color: "text-red-600",
    bgColor: "bg-red-500/10",
    pulse: false,
    icon: "x",
  },
  abandoned: {
    label: "Abandoned",
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    pulse: false,
    icon: "alert",
  },
  stopped: {
    label: "Stopped",
    color: "text-orange-600",
    bgColor: "bg-orange-500/10",
    pulse: false,
    icon: "stop",
  },
};

// --- Parsing helper ---

export function parseSessionMetrics(json: unknown): SessionReport | null {
  if (!json || typeof json !== "object") return null;

  const m = json as Record<string, unknown>;

  // Validate required fields
  if (typeof m.sessionId !== "string" || typeof m.durationMs !== "number") {
    return null;
  }

  return {
    sessionId: m.sessionId as string,
    taskId: (m.taskId as string) ?? "",
    startedAt: (m.startedAt as string) ?? "",
    durationMs: (m.durationMs as number) ?? 0,
    activeMs: (m.activeMs as number) ?? 0,
    idlePeriods: (m.idlePeriods as number) ?? 0,
    isIdle: (m.isIdle as boolean) ?? false,
    files: m.files
      ? (m.files as SessionMetrics["files"])
      : { changed: 0, totalLinesAdded: 0, totalLinesRemoved: 0, topFiles: [] },
    git: m.git
      ? (m.git as SessionMetrics["git"])
      : { commitCount: 0, commits: [] },
    tests: m.tests
      ? (m.tests as AggregatedTestResults)
      : {
          runs: [],
          totalPassed: 0,
          totalFailed: 0,
          totalSkipped: 0,
          totalTests: 0,
          detectedFrameworks: [],
        },
    issues: Array.isArray((m as Record<string, unknown>).issues)
      ? ((m as Record<string, unknown>).issues as DetectedIssue[])
      : undefined,
    developerNotes:
      typeof (m as Record<string, unknown>).developerNotes === "string"
        ? ((m as Record<string, unknown>).developerNotes as string)
        : undefined,
  };
}

// --- Utility to check stale heartbeat ---

export function isStaleHeartbeat(session: ClaudeCodeSession): boolean {
  if (!session.last_heartbeat_at) return false;
  const lastBeat = new Date(session.last_heartbeat_at).getTime();
  return Date.now() - lastBeat > 2 * 60 * 1000; // 2 minutes
}

// --- AI-assisted metrics (from sprint_metrics ai_* columns) ---

export interface AiAssistedMetrics {
  sessionsCount: number;
  sessionsCompleted: number;
  completionRate: number;
  pointsCompleted: number;
  contributionRate: number;
  acMetRate: number;
  bugsDetected: number;
  techDebtDetected: number;
  avgSessionDurationMs: number;
  qualityScore: number;
  efficiencyMultiplier: number;
  // Phase 1A: AI behavior metrics
  aiAcceptanceRate: number;
  conflictRate: number;
  lateArrivalRate: number;
}

// --- Issue breakdown for analytics ---

export interface IssueBreakdown {
  id: string;
  type: string;
  severity: string | null;
  title: string | null;
  filePath: string | null;
  status: string | null;
  suggestedPoints: number | null;
  createdAt: string | null;
}

// --- Sprint analytics response type ---

export interface SprintClaudeCodeAnalytics {
  sprintId: string;
  sessionCount: number;
  totalDurationMs: number;
  avgDurationMs: number;
  totalFilesChanged: number;
  totalCommits: number;
  totalTestsPassed: number;
  totalTestsFailed: number;
  issuesByType: Record<string, number>;
  completionRate: number;
  sessions: Array<{
    id: string;
    taskId: string;
    taskName: string;
    userId: string;
    userName: string | null;
    status: string;
    startedAt: string;
    completedAt: string | null;
    durationMs: number;
    filesChanged: number;
    commits: number;
    bugsDetected: number;
    techDebtDetected: number;
    metrics: SessionReport | null;
  }>;
  issues: IssueBreakdown[];
  aggregates: {
    totalBugsDetected: number;
    totalTechDebtDetected: number;
    totalPointsCompleted: number;
    avgQualityScore: number;
  };
  // Phase 1A: AI behavior metrics from live claude_code_sessions columns
  aiAcceptanceRate: number; // % of completed sessions without conflicts (proxy for AI output acceptance)
  conflictRate: number; // % of sessions where conflict_detected = true
  lateArrivalRate: number; // % of sessions where is_late_arrival = true
  conflictCount: number;
  lateArrivalCount: number;
}
