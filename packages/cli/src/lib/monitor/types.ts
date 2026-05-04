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

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
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
  tokens?: TokenUsage;
  pendingReportsCount?: number;
}

export interface HeartbeatPayload {
  token: string;
  sequence: number;
  metrics: SessionMetrics;
}

export interface HeartbeatResponse {
  accepted: boolean;
  lastSequence: number;
  sessionStatus?: string;
  reason?: string;
}

export interface PersistedSessionState {
  sessionId: string;
  taskId: string;
  token: string;
  workingDir: string;
  startedAt: string;
  lastActiveAt: string;
  heartbeatSequence: number;
  knownCommitShas: string[];
  fileChanges: Record<string, FileChange>;
  testRuns: TestRunResult[];
  idlePeriods: number;
  activeMs: number;
}

export interface ClaudeCodeReport {
  status?: 'completed' | 'blocked' | 'needs_review';
  ac_results?: { index: number; met: boolean; evidence?: string }[];
  issues?: {
    type: 'bug' | 'tech_debt' | 'followup';
    title: string;
    description?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    file_path?: string;
    line_number?: number;
    suggested_points?: number;
  }[];
  summary?: string;
}

export interface ProposedChanges {
  status_id?: string;
  assignee_id?: string | null;
  description?: string | null;
  story_points?: number | null;
  estimated_time?: number | null;
}

export interface CompletionPayload {
  status: string;
  token: string;
  metrics?: SessionMetrics;
  completion_report?: ClaudeCodeReport | null;
  developer_notes?: string | null;
  proposed_status?: string | null;
  proposed_changes?: ProposedChanges;
  ac_met?: number | null;
  ac_total?: number | null;
  bugs_detected?: number | null;
  tech_debt_detected?: number | null;
  issues?: ClaudeCodeReport['issues'] | null;
  // Token accounting — flat fields so the server can persist without reaching into metrics
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
}

export interface PendingReport {
  sessionId: string;
  taskId: string;
  token: string;
  status: string;
  metrics: SessionMetrics;
  proposed_changes?: ProposedChanges;
  completion_report?: ClaudeCodeReport | null;
  developer_notes?: string | null;
  proposed_status?: string | null;
  ac_met?: number | null;
  ac_total?: number | null;
  bugs_detected?: number | null;
  tech_debt_detected?: number | null;
  issues?: ClaudeCodeReport['issues'] | null;
  failedAt: string;
}

export interface MonitorConfig {
  filePollMs: number;
  gitPollMs: number;
  heartbeatMs: number;
  stateSaveMs: number;
  idleThresholdMs: number;
  excludePatterns: string[];
}
