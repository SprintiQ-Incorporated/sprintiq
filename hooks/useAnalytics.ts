"use client";

/**
 * Analytics Hooks
 *
 * React Query hooks for fetching live workspace analytics. Surfaces tied to
 * dropped tables (velocity history, archived sprints, user baselines, NPS,
 * patterns, quality, capacity, time savings) were removed during the OSS
 * reduction; the remaining hooks here read from Claude Code session data.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SprintClaudeCodeAnalytics } from "@/lib/types/claude-code-metrics";
import type { ClaudeCodeIssue } from "@/lib/database-aliases";

// ============================================================================
// Types
// ============================================================================

export type AnalyticsRange = "7d" | "30d" | "90d";

// ============================================================================
// Claude Code Analytics
// ============================================================================

async function fetchClaudeCodeAnalytics(
  workspaceId: string,
  sprintId: string
): Promise<SprintClaudeCodeAnalytics> {
  const response = await fetch(
    `/api/analytics/claude-code?workspace_id=${workspaceId}&sprint_id=${sprintId}`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch Claude Code analytics");
  }
  return response.json();
}

async function fetchTaskIssues(
  taskId: string
): Promise<{ issues: ClaudeCodeIssue[] }> {
  const response = await fetch(
    `/api/claude-code/issues?task_id=${taskId}`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch task issues");
  }
  return response.json();
}

export function useClaudeCodeAnalytics(
  workspaceId: string,
  sprintId: string
) {
  return useQuery<SprintClaudeCodeAnalytics, Error>({
    queryKey: ["analytics", "claude-code", workspaceId, sprintId],
    queryFn: () => fetchClaudeCodeAnalytics(workspaceId, sprintId),
    enabled: !!workspaceId && !!sprintId,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useTaskIssues(taskId: string) {
  return useQuery<{ issues: ClaudeCodeIssue[] }, Error>({
    queryKey: ["claude-code", "issues", taskId],
    queryFn: () => fetchTaskIssues(taskId),
    enabled: !!taskId,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePromoteIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      issueId,
      asSubtask,
      overridePoints,
      overrideTitle,
    }: {
      issueId: string;
      asSubtask?: boolean;
      overridePoints?: number;
      overrideTitle?: string;
    }) => {
      const response = await fetch(
        `/api/claude-code/issues/${issueId}/promote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            as_subtask: asSubtask,
            override_points: overridePoints,
            override_title: overrideTitle,
          }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to promote issue");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claude-code", "issues"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "claude-code"] });
    },
  });
}

export function useDismissIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (issueId: string) => {
      const response = await fetch(
        `/api/claude-code/issues/${issueId}`,
        { method: "PATCH" }
      );
      if (!response.ok) {
        throw new Error("Failed to dismiss issue");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claude-code", "issues"] });
      queryClient.invalidateQueries({ queryKey: ["analytics", "claude-code"] });
    },
  });
}
