"use client";

import { FileText, GitCommit, TestTube2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionReport } from "@/lib/types/claude-code-metrics";

interface SessionMetricsStripProps {
  metrics: SessionReport;
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

export function SessionMetricsStrip({
  metrics,
  className,
}: SessionMetricsStripProps) {
  const totalTests = metrics.tests.totalTests;
  const failedTests = metrics.tests.totalFailed;

  return (
    <div className={cn("flex items-center gap-4 text-xs workspace-text-muted", className)}>
      <div className="flex items-center gap-1" title="Files changed">
        <FileText className="h-3.5 w-3.5" />
        <span>{metrics.files.changed}</span>
      </div>

      <div className="flex items-center gap-1" title="Commits">
        <GitCommit className="h-3.5 w-3.5" />
        <span>{metrics.git.commitCount}</span>
      </div>

      {totalTests > 0 && (
        <div
          className={cn(
            "flex items-center gap-1",
            failedTests > 0 ? "text-red-500" : "text-green-600"
          )}
          title={`${metrics.tests.totalPassed} passed, ${failedTests} failed, ${metrics.tests.totalSkipped} skipped`}
        >
          <TestTube2 className="h-3.5 w-3.5" />
          <span>
            {metrics.tests.totalPassed}/{totalTests}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1" title="Active duration">
        <Clock className="h-3.5 w-3.5" />
        <span>{formatDuration(metrics.activeMs)}</span>
      </div>
    </div>
  );
}
