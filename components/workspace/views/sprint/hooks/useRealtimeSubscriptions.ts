import { useEffect, useRef, useCallback } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import type { Workspace, Sprint } from "@/lib/database-aliases";

interface UseRealtimeSubscriptionsProps {
  supabase: ReturnType<typeof createClientSupabaseClient>;
  workspace: Workspace;
  sprint: Sprint;
  refreshTasks: () => Promise<void>;
  refreshStatuses: () => Promise<void>;
  loadAllSubtasks: () => Promise<void>;
}

/**
 * Debounce helper: coalesces rapid-fire calls into a single trailing call.
 * Returns a stable callback that delays execution by `delay` ms.
 */
function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const debounced = useCallback((...args: unknown[]) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fnRef.current(...args);
    }, delay);
  }, [delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return debounced as unknown as T;
}

export function useRealtimeSubscriptions({
  supabase,
  workspace,
  sprint,
  refreshTasks,
  refreshStatuses,
  loadAllSubtasks,
}: UseRealtimeSubscriptionsProps) {
  // BUG FIX #2: Debounce refresh calls to prevent storms from rapid events
  const debouncedRefreshTasks = useDebouncedCallback(refreshTasks, 500);
  const debouncedLoadAllSubtasks = useDebouncedCallback(loadAllSubtasks, 500);
  const debouncedRefreshStatuses = useDebouncedCallback(refreshStatuses, 500);

  useEffect(() => {
    // BUG FIX #1: Include sprint.id in channel names to prevent cross-tab collisions
    const tasksSubscription = supabase
      .channel(`sprint_tasks_changes_${sprint.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `sprint_id=eq.${sprint.id}`,
        },
        () => {
          debouncedRefreshTasks();
          debouncedLoadAllSubtasks();
        }
      )
      .subscribe();

    const statusesSubscription = supabase
      .channel(`sprint_statuses_changes_${sprint.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "statuses",
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => {
          debouncedRefreshStatuses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tasksSubscription);
      supabase.removeChannel(statusesSubscription);
    };
  }, [
    supabase,
    workspace.id,
    sprint.id,
    debouncedRefreshTasks,
    debouncedRefreshStatuses,
    debouncedLoadAllSubtasks,
  ]);
}
