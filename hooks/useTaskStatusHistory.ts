/**
 * React Query hook for Task Status History
 *
 * Fetches status change history for a task with user information
 * for sprint retrospectives and task analysis.
 */

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { createClientSupabaseClient } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface StatusHistoryEntry {
  id: string;
  taskId: string;
  fromStatusName: string | null;
  toStatusName: string | null;
  fromStatusType: string | null;
  toStatusType: string | null;
  changedBy: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
  changedAt: string | null;
  timeInStatusMs: number | null;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format milliseconds into a human-readable duration string
 */
export function formatTimeInStatus(ms: number | null): string {
  if (!ms || ms <= 0) return "< 1m";

  const minutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Fetch status history for a task
 *
 * @param taskId - The task UUID
 * @param limit - Maximum number of entries to fetch (default: 20)
 * @returns Query result with status history entries
 *
 * @example
 * ```tsx
 * function TaskHistory({ taskId }: Props) {
 *   const { data: history, isLoading } = useTaskStatusHistory(taskId);
 *
 *   if (isLoading) return <Skeleton />;
 *
 *   return (
 *     <Timeline entries={history} />
 *   );
 * }
 * ```
 */
export function useTaskStatusHistory(
  taskId: string | undefined,
  limit: number = 20
): UseQueryResult<StatusHistoryEntry[]> {
  return useQuery({
    queryKey: ["task-status-history", taskId, limit],
    queryFn: async (): Promise<StatusHistoryEntry[]> => {
      if (!taskId) return [];

      const supabase = createClientSupabaseClient();

      // Fetch status history entries
      const { data, error } = await supabase
        .from("task_status_history")
        .select(
          `
          id,
          task_id,
          from_status_name,
          to_status_name,
          from_status_type,
          to_status_type,
          changed_at,
          time_in_status_ms,
          metadata,
          changed_by
        `
        )
        .eq("task_id", taskId)
        .order("changed_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Failed to fetch status history:", error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Fetch profiles for changed_by users in a separate query
      const changedByIds = [
        ...new Set(
          data
            .map((entry) => entry.changed_by)
            .filter((id): id is string => id !== null)
        ),
      ];

      let profilesMap: Record<
        string,
        { id: string; full_name: string | null; avatar_url: string | null }
      > = {};

      if (changedByIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", changedByIds);

        if (profiles) {
          profilesMap = profiles.reduce(
            (acc, p) => {
              acc[p.id] = p;
              return acc;
            },
            {} as Record<
              string,
              { id: string; full_name: string | null; avatar_url: string | null }
            >
          );
        }
      }

      // Map to StatusHistoryEntry format
      return data.map((entry) => ({
        id: entry.id,
        taskId: entry.task_id,
        fromStatusName: entry.from_status_name,
        toStatusName: entry.to_status_name,
        fromStatusType: entry.from_status_type,
        toStatusType: entry.to_status_type,
        changedBy: entry.changed_by
          ? {
              id: entry.changed_by,
              fullName: profilesMap[entry.changed_by]?.full_name || null,
              avatarUrl: profilesMap[entry.changed_by]?.avatar_url || null,
            }
          : null,
        changedAt: entry.changed_at,
        timeInStatusMs: entry.time_in_status_ms,
        metadata: (entry.metadata as Record<string, unknown>) || {},
      }));
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!taskId,
  });
}
