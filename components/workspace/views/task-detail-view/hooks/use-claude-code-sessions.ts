"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { csrfFetch } from "@/hooks/useCsrfFetch";
import { useAuth } from "@/contexts/auth-context";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import type {
  Task,
  Workspace,
  ClaudeCodeSession,
  Json,
} from "@/lib/database-aliases";

interface UseClaudeCodeSessionsParams {
  task: Task;
  workspace: Workspace;
  taskContext: { [key: string]: Json | undefined };
  /** BUG FIX #5: Called when the task itself is updated (e.g., CLI auto-applies status change) */
  onTaskUpdated?: (updatedTask: Task) => void;
}

export function useClaudeCodeSessions({
  task,
  workspace,
  taskContext,
  onTaskUpdated,
}: UseClaudeCodeSessionsParams) {
  const [sessions, setSessions] = useState<ClaudeCodeSession[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const { user } = useAuth();
  const { toast } = useEnhancedToast();
  const [supabase] = useState(() => createClientSupabaseClient());

  // Fetch sessions for this task
  const fetchSessions = useCallback(async () => {
    try {
      const response = await csrfFetch(
        `/api/claude-code/sessions?taskId=${task.id}`
      );
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error("Failed to fetch claude code sessions:", error);
    }
  }, [task.id]);

  // Initial fetch
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`claude_code_sessions_${task.id}_${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "claude_code_sessions",
          filter: `task_id=eq.${task.id}`,
        },
        (payload) => {
          const newRecord = payload.new as ClaudeCodeSession;
          const eventType = payload.eventType;

          if (eventType === "INSERT") {
            setSessions((prev) => [newRecord, ...prev]);
          } else if (eventType === "UPDATE") {
            setSessions((prev) =>
              prev.map((s) => (s.id === newRecord.id ? newRecord : s))
            );

            // Toast on status transitions
            if (newRecord.status === "active") {
              toast({
                title: "Session Active",
                description: "Claude Code session is now active",
              });
            } else if (newRecord.status === "completed") {
              if (newRecord.conflict_detected) {
                toast({
                  title: "Conflict Detected",
                  description:
                    "Task was updated while Claude Code was running. Review the conflict.",
                  variant: "warning",
                });
              } else if (newRecord.is_late_arrival) {
                toast({
                  title: "Late Session Completion",
                  description:
                    "A previously abandoned session has reported completion.",
                });
              } else {
                // Build a description that includes what was synced
                const parts: string[] = [];
                if (newRecord.proposed_status) {
                  parts.push(`status → ${newRecord.proposed_status}`);
                }
                if (newRecord.ac_met != null && newRecord.ac_total != null) {
                  parts.push(`${newRecord.ac_met}/${newRecord.ac_total} AC met`);
                }
                if (newRecord.bugs_detected) {
                  parts.push(`${newRecord.bugs_detected} bug(s) detected`);
                }

                const detail = parts.length > 0
                  ? `Task updated: ${parts.join(", ")}`
                  : "Claude Code session completed successfully";

                toast({
                  title: "Session Completed — Task Updated",
                  description: detail,
                });
              }
            } else if (newRecord.status === "failed") {
              toast({
                title: "Session Failed",
                description:
                  newRecord.error_message || "Claude Code session failed",
                variant: "destructive",
              });
            } else if (newRecord.status === "abandoned") {
              toast({
                title: "Session Abandoned",
                description:
                  "Claude Code session was marked as abandoned due to inactivity",
                variant: "warning",
              });
            }
          } else if (eventType === "DELETE") {
            const oldRecord = payload.old as { id: string };
            setSessions((prev) => prev.filter((s) => s.id !== oldRecord.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, task.id, toast]);

  // BUG FIX #5: Subscribe to task changes so the detail view refreshes
  // when the CLI auto-applies status/field changes on session completion
  useEffect(() => {
    if (!onTaskUpdated) return;

    const channel = supabase
      .channel(`task_detail_${task.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          filter: `id=eq.${task.id}`,
        },
        (payload) => {
          const updated = payload.new as Task;
          onTaskUpdated(updated);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, task.id, onTaskUpdated]);

  // Start a new session
  const startSession = useCallback(async (): Promise<{ sessionId: string; token: string; taskId: string } | null> => {
    if (!user) return null;

    setIsCreating(true);
    try {
      const response = await csrfFetch("/api/claude-code/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          workspaceId: workspace.id,
          taskContext,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.error || "Failed to create session",
          variant: "destructive",
        });
        return null;
      }

      const data = await response.json();

      return { sessionId: data.session.id, token: data.sessionToken, taskId: data.taskId };
    } catch (error) {
      console.error("Failed to start claude code session:", error);
      toast({
        title: "Error",
        description: "Failed to start Claude Code session",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [user, task.id, workspace.id, taskContext, toast]);

  // Stop a session
  const stopSession = useCallback(
    async (sessionId: string) => {
      if (!user) return;

      setIsStopping(true);
      try {
        const response = await csrfFetch(
          `/api/claude-code/sessions/${sessionId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "stopped" }),
          }
        );

        if (!response.ok) {
          toast({
            title: "Error",
            description: "Failed to stop session",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Session Stopped",
          description: "Claude Code session has been stopped",
        });
      } catch (error) {
        console.error("Failed to stop claude code session:", error);
        toast({
          title: "Error",
          description: "Failed to stop session",
          variant: "destructive",
        });
      } finally {
        setIsStopping(false);
      }
    },
    [user, toast]
  );

  // Resolve a conflict
  const resolveConflict = useCallback(
    async (
      sessionId: string,
      resolution: "keep_manual" | "apply_ai" | "field_level",
      fieldResolutions?: Record<string, "keep_manual" | "apply_ai">
    ) => {
      setIsResolving(true);
      try {
        const response = await csrfFetch(
          `/api/claude-code/sessions/${sessionId}/resolve-conflict`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resolution, fieldResolutions }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          toast({
            title: "Error",
            description: errorData.error || "Failed to resolve conflict",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Conflict Resolved",
          description: `Applied resolution: ${resolution.replace(/_/g, " ")}`,
        });

        fetchSessions();
      } catch (error) {
        console.error("Failed to resolve conflict:", error);
        toast({
          title: "Error",
          description: "Failed to resolve conflict",
          variant: "destructive",
        });
      } finally {
        setIsResolving(false);
      }
    },
    [toast, fetchSessions]
  );

  // Dismiss a late arrival (marks conflict as resolved with keep_manual)
  const dismissLateArrival = useCallback(
    async (sessionId: string) => {
      await resolveConflict(sessionId, "keep_manual");
    },
    [resolveConflict]
  );

  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status === "pending" || s.status === "active"),
    [sessions]
  );

  const conflictSessions = useMemo(
    () =>
      sessions.filter(
        (s) => s.conflict_detected && !s.conflict_resolved_at
      ),
    [sessions]
  );

  const lateArrivalSessions = useMemo(
    () =>
      sessions.filter(
        (s) => s.is_late_arrival && !s.conflict_resolved_at
      ),
    [sessions]
  );

  const abandonedSessions = useMemo(
    () => sessions.filter((s) => s.status === "abandoned"),
    [sessions]
  );

  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === "completed" || s.status === "stopped"),
    [sessions]
  );

  const latestSession = useMemo(
    () => sessions.length > 0 ? sessions[0] : null,
    [sessions]
  );

  const hasActiveSessions = activeSessions.length > 0;

  return {
    sessions,
    activeSessions,
    completedSessions,
    latestSession,
    hasActiveSessions,
    conflictSessions,
    lateArrivalSessions,
    abandonedSessions,
    isCreating,
    isStopping,
    isResolving,
    startSession,
    stopSession,
    resolveConflict,
    dismissLateArrival,
    fetchSessions,
  };
}
