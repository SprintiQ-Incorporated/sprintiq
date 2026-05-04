"use client";

import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Zap,
  FileText,
  GitCommit,
  TestTube2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SprintClaudeCodeAnalytics } from "@/lib/types/claude-code-metrics";

interface ClaudeCodeSprintActivityProps {
  sprintId: string;
  workspaceId: string;
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const STORAGE_KEY = "sprintiq_sprint_activity_collapsed";

export function ClaudeCodeSprintActivity({
  sprintId,
  workspaceId,
}: ClaudeCodeSprintActivityProps) {
  const [analytics, setAnalytics] = useState<SprintClaudeCodeAnalytics | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(STORAGE_KEY) !== "false";
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(
          `/api/analytics/claude-code?sprint_id=${sprintId}&workspace_id=${workspaceId}`
        );
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data);
        }
      } catch {
        // Silently fail - panel just won't render
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [sprintId, workspaceId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  // Don't render if no sessions
  if (loading || !analytics || analytics.sessionCount === 0) return null;

  const activeSessions = analytics.sessions.filter(
    (s) => s.status === "active" || s.status === "pending"
  ).length;

  return (
    <div className="mx-3 mb-2 border workspace-border rounded-lg workspace-secondary-sidebar-bg overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs">
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5 workspace-text-muted" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 workspace-text-muted" />
          )}
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span className="font-medium">Claude Code Activity</span>
          {activeSessions > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px] font-medium bg-green-500/10 text-green-600">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
              </span>
              {activeSessions} active
            </span>
          )}
        </div>
        <span className="text-[10px] workspace-text-muted">
          {analytics.sessionCount} sessions
        </span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 pt-1 border-t workspace-border">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricItem
              icon={<Users className="h-3.5 w-3.5" />}
              label="Sessions"
              value={String(analytics.sessionCount)}
              sub={`${Math.round(analytics.completionRate * 100)}% completed`}
            />
            <MetricItem
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Files Changed"
              value={String(analytics.totalFilesChanged)}
            />
            <MetricItem
              icon={<GitCommit className="h-3.5 w-3.5" />}
              label="Commits"
              value={String(analytics.totalCommits)}
            />
            <MetricItem
              icon={<TestTube2 className="h-3.5 w-3.5" />}
              label="Tests"
              value={`${analytics.totalTestsPassed}/${analytics.totalTestsPassed + analytics.totalTestsFailed}`}
              sub={analytics.totalTestsFailed > 0 ? `${analytics.totalTestsFailed} failed` : undefined}
              subColor={analytics.totalTestsFailed > 0 ? "text-red-500" : undefined}
            />
            <MetricItem
              icon={<Zap className="h-3.5 w-3.5" />}
              label="Avg Duration"
              value={formatDuration(analytics.avgDurationMs)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricItem({
  icon,
  label,
  value,
  sub,
  subColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="workspace-text-muted mt-0.5">{icon}</span>
      <div>
        <div className="text-xs font-medium">{value}</div>
        <div className="text-[10px] workspace-text-muted">{label}</div>
        {sub && (
          <div className={cn("text-[10px]", subColor ?? "workspace-text-muted")}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
