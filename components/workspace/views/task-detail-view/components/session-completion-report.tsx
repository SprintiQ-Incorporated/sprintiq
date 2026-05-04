"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  GitCommit,
  TestTube2,
  Clock,
  AlertTriangle,
  Plus,
  StickyNote,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SessionReport, DetectedIssue } from "@/lib/types/claude-code-metrics";

interface SessionCompletionReportProps {
  metrics: SessionReport;
  onCreateSubtask?: (issueMessage: string) => void;
  className?: string;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}

const severityColors: Record<DetectedIssue["severity"], string> = {
  critical: "bg-red-500/10 text-red-700",
  high: "bg-orange-500/10 text-orange-700",
  medium: "bg-yellow-500/10 text-yellow-700",
  low: "bg-blue-500/10 text-blue-700",
};

const typeLabels: Record<DetectedIssue["type"], string> = {
  bug: "Bug",
  security: "Security",
  performance: "Performance",
  style: "Style",
  warning: "Warning",
};

export function SessionCompletionReport({
  metrics,
  onCreateSubtask,
  className,
}: SessionCompletionReportProps) {
  const [showFiles, setShowFiles] = useState(false);

  const sortedFiles = [...(metrics.files.topFiles || [])].sort(
    (a, b) =>
      Math.abs(b.linesAdded + b.linesRemoved) -
      Math.abs(a.linesAdded + a.linesRemoved)
  );

  return (
    <div className={cn("space-y-4 text-sm", className)}>
      {/* Duration */}
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 workspace-text-muted" />
        <span className="font-medium">Duration</span>
        <span className="workspace-text-muted">
          {formatDuration(metrics.durationMs)} total, {formatDuration(metrics.activeMs)} active
          {metrics.idlePeriods > 0 && ` (${metrics.idlePeriods} idle periods)`}
        </span>
      </div>

      {/* Files */}
      {metrics.files.changed > 0 && (
        <div>
          <button
            onClick={() => setShowFiles(!showFiles)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            {showFiles ? (
              <ChevronDown className="h-4 w-4 workspace-text-muted" />
            ) : (
              <ChevronRight className="h-4 w-4 workspace-text-muted" />
            )}
            <FileText className="h-4 w-4 workspace-text-muted" />
            <span className="font-medium">
              {metrics.files.changed} files changed
            </span>
            <span className="workspace-text-muted">
              +{metrics.files.totalLinesAdded} / -{metrics.files.totalLinesRemoved}
            </span>
          </button>
          {showFiles && sortedFiles.length > 0 && (
            <div className="ml-6 mt-2 space-y-1">
              {sortedFiles.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center justify-between text-xs font-mono py-0.5"
                >
                  <span className="truncate workspace-text-muted max-w-[300px]">
                    {file.path}
                  </span>
                  <span className="ml-2 flex-shrink-0">
                    <span className="text-green-600">+{file.linesAdded}</span>
                    {" / "}
                    <span className="text-red-500">-{file.linesRemoved}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Commits */}
      {metrics.git.commitCount > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <GitCommit className="h-4 w-4 workspace-text-muted" />
            <span className="font-medium">{metrics.git.commitCount} commits</span>
          </div>
          <div className="ml-6 space-y-1.5">
            {metrics.git.commits.map((commit) => (
              <div key={commit.sha} className="flex items-start gap-2 text-xs">
                <code className="text-blue-600 flex-shrink-0">
                  {commit.sha.slice(0, 7)}
                </code>
                <span className="truncate">{commit.message}</span>
                <span className="workspace-text-muted flex-shrink-0">
                  {formatDistanceToNow(new Date(commit.timestamp), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tests */}
      {metrics.tests.totalTests > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TestTube2 className="h-4 w-4 workspace-text-muted" />
            <span className="font-medium">Tests</span>
            <div className="flex items-center gap-1.5">
              {metrics.tests.detectedFrameworks.map((fw) => (
                <Badge key={fw} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {fw}
                </Badge>
              ))}
            </div>
          </div>
          <div className="ml-6 flex items-center gap-3 text-xs">
            <span className="text-green-600">{metrics.tests.totalPassed} passed</span>
            {metrics.tests.totalFailed > 0 && (
              <span className="text-red-500">{metrics.tests.totalFailed} failed</span>
            )}
            {metrics.tests.totalSkipped > 0 && (
              <span className="workspace-text-muted">{metrics.tests.totalSkipped} skipped</span>
            )}
            {metrics.tests.runs.some((r) => r.coveragePercent != null) && (
              <span className="workspace-text-muted">
                {Math.round(
                  metrics.tests.runs.reduce(
                    (sum, r) => sum + (r.coveragePercent ?? 0),
                    0
                  ) / metrics.tests.runs.filter((r) => r.coveragePercent != null).length
                )}
                % coverage
              </span>
            )}
          </div>
        </div>
      )}

      {/* Issues Detected */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 workspace-text-muted" />
          <span className="font-medium">Issues Detected</span>
        </div>
        {metrics.issues && metrics.issues.length > 0 ? (
          <div className="ml-6 space-y-2">
            {metrics.issues.map((issue, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-2 text-xs"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <Badge
                    className={cn(
                      "text-[10px] px-1.5 py-0 flex-shrink-0",
                      severityColors[issue.severity]
                    )}
                  >
                    {typeLabels[issue.type]}
                  </Badge>
                  <span className="break-words">{issue.message}</span>
                  {issue.file && (
                    <span className="workspace-text-muted flex-shrink-0 font-mono">
                      {issue.file}
                      {issue.line != null ? `:${issue.line}` : ""}
                    </span>
                  )}
                </div>
                {!issue.linkedSubtaskId && onCreateSubtask && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] flex-shrink-0"
                    onClick={() => onCreateSubtask(issue.message)}
                  >
                    <Plus className="h-3 w-3 mr-0.5" />
                    Subtask
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="ml-6 text-xs workspace-text-muted">No issues detected</p>
        )}
      </div>

      {/* Developer Notes */}
      {metrics.developerNotes && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <StickyNote className="h-4 w-4 workspace-text-muted" />
            <span className="font-medium">Developer Notes</span>
          </div>
          <p className="ml-6 text-xs workspace-text-muted whitespace-pre-wrap">
            {metrics.developerNotes}
          </p>
        </div>
      )}
    </div>
  );
}
