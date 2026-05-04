"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { getAvatarInitials } from "@/lib/utils";
import type { ClaudeCodeSession, Profile } from "@/lib/database-aliases";
import type { ActiveSessionInfo } from "../types";

interface UseSprintActiveSessionsParams {
  sprintId: string;
  workspaceId: string;
  taskIds: string[];
  workspaceMembers: Profile[];
}

export function useSprintActiveSessions({
  sprintId,
  workspaceId,
  taskIds,
  workspaceMembers,
}: UseSprintActiveSessionsParams): Map<string, ActiveSessionInfo> {
  const [activeSessions, setActiveSessions] = useState<ClaudeCodeSession[]>([]);
  // BUG FIX #6: Use useState to avoid creating a new client on every render
  const [supabase] = useState(() => createClientSupabaseClient());

  // BUG FIX #4: Stabilize taskIds to prevent subscription churn on reference changes.
  // Only update the stable ref when the actual IDs change (by value, not reference).
  const stableTaskIdsRef = useRef<string[]>(taskIds);
  const taskIdsKey = taskIds.join(",");
  if (stableTaskIdsRef.current.join(",") !== taskIdsKey) {
    stableTaskIdsRef.current = taskIds;
  }
  const stableTaskIds = stableTaskIdsRef.current;

  // Fetch active sessions for all tasks in the sprint
  useEffect(() => {
    if (stableTaskIds.length === 0) return;

    const fetchActiveSessions = async () => {
      const { data } = await supabase
        .from("claude_code_sessions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("task_id", stableTaskIds)
        .in("status", ["pending", "active"]);

      if (data) {
        setActiveSessions(data);
      }
    };

    fetchActiveSessions();
  }, [supabase, workspaceId, stableTaskIds]);

  // Realtime subscription for the sprint's sessions
  useEffect(() => {
    if (stableTaskIds.length === 0) return;

    const channel = supabase
      .channel(`sprint_active_sessions_${sprintId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "claude_code_sessions",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const newRecord = payload.new as ClaudeCodeSession;
          const eventType = payload.eventType;

          // Only care about tasks in this sprint
          // Use ref to always have the latest taskIds without resubscribing
          if (newRecord && !stableTaskIdsRef.current.includes(newRecord.task_id)) return;

          if (eventType === "INSERT") {
            if (newRecord.status === "pending" || newRecord.status === "active") {
              setActiveSessions((prev) => [...prev, newRecord]);
            }
          } else if (eventType === "UPDATE") {
            if (newRecord.status === "pending" || newRecord.status === "active") {
              setActiveSessions((prev) => {
                const exists = prev.some((s) => s.id === newRecord.id);
                return exists
                  ? prev.map((s) => (s.id === newRecord.id ? newRecord : s))
                  : [...prev, newRecord];
              });
            } else {
              // Session no longer active
              setActiveSessions((prev) =>
                prev.filter((s) => s.id !== newRecord.id)
              );
            }
          } else if (eventType === "DELETE") {
            const oldRecord = payload.old as { id: string };
            setActiveSessions((prev) =>
              prev.filter((s) => s.id !== oldRecord.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // BUG FIX #4: Depend on sprintId and workspaceId only (not taskIds),
    // since the filter is workspace-wide and the callback reads from ref
  }, [supabase, sprintId, workspaceId]);

  // Build Map<taskId, ActiveSessionInfo>
  const sessionMap = useMemo(() => {
    const map = new Map<string, ActiveSessionInfo>();

    for (const session of activeSessions) {
      // Use the first (most recent) active session per task
      if (map.has(session.task_id)) continue;

      const member = workspaceMembers.find((m) => m.id === session.user_id);
      map.set(session.task_id, {
        userInitials: getAvatarInitials(member?.full_name, member?.email) ?? "??",
        userName: member?.full_name ?? member?.email ?? "Unknown",
        startedAt: session.started_at ?? '',
      });
    }

    return map;
  }, [activeSessions, workspaceMembers]);

  return sessionMap;
}
