/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useState, useEffect } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import type { Task, Workspace } from "@/lib/database-aliases";

export const useTaskData = (task: Task, workspace: Workspace) => {
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [taskAssignees, setTaskAssignees] = useState<any[]>([]);

  const supabase = createClientSupabaseClient();

  const loadSubtasks = async () => {
    if (!task.id) {
      console.error("❌ Task ID is missing:", task.id);
      return;
    }

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error("❌ Auth error:", authError);
        return;
      }

      const { data: subtasksData, error } = await supabase
        .from("tasks")
        .select(
          `
          *,
          assignee:profiles!tasks_assignee_id_fkey(*),
          status:statuses(*),
          task_tags(
            tag:tags(*)
          )
        `
        )
        .eq("parent_task_id", task.id)
        .order("created_at", { ascending: true })
        .returns<Task[]>();

      if (error) {
        console.error("❌ Query failed:", error);
        return;
      }

      setSubtasks(subtasksData || []);
    } catch (exception) {
      console.error("💥 Exception caught:", {
        message: exception instanceof Error ? exception.message : "Unknown",
        stack: exception instanceof Error ? exception.stack : "No stack",
        type: typeof exception,
      });
    }
  };

  // PHASE_5_NOOP: was multi-user member fetch — load only the workspace owner's profile
  const loadWorkspaceMembers = async () => {
    if (!workspace?.owner_id) {
      setWorkspaceMembers([]);
      return;
    }
    try {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("id", workspace.owner_id)
        .maybeSingle();
      setWorkspaceMembers(
        ownerProfile
          ? [
              {
                id: ownerProfile.id,
                full_name: ownerProfile.full_name || "",
                email: ownerProfile.email || "",
                avatar_url: ownerProfile.avatar_url || null,
              },
            ]
          : []
      );
    } catch (error) {
      console.error("Exception in loadWorkspaceMembers:", error);
    }
  };

  // PHASE_5_NOOP: was multi-user team-member fetch, OSS is single-user
  const loadTeamMembers = async () => {
    setTeamMembers([]);
  };

  const loadTaskAssignees = async () => {
    try {
      const assignees = [];

      // Add profile assignee if exists
      if (task.assignee_id && task.assignee) {
        assignees.push({
          ...task.assignee,
          type: "profile",
        });
      }

      setTaskAssignees(assignees);
    } catch (error) {
      console.error("Error loading task assignees:", error);
    }
  };

  useEffect(() => {

    loadSubtasks();
    loadWorkspaceMembers();
    loadTeamMembers();
    loadTaskAssignees();
  }, [task.id]);

  useEffect(() => {
    loadTaskAssignees();
  }, [
    task.assignee_id,
    task.assignee,
  ]);

  return {
    subtasks,
    setSubtasks,
    workspaceMembers,
    teamMembers,
    taskAssignees,
    setTaskAssignees,
    loadSubtasks,
    loadWorkspaceMembers,
    loadTeamMembers,
    loadTaskAssignees,
  };
};
