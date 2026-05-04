/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
import { useState, useCallback, useEffect, useRef } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import type {
  Task,
  Status,
  Tag,
  Profile,
} from "@/lib/database-aliases";
import type {
  WorkspaceBase,
  SpaceBase,
  SprintBase,
  SprintFolderBase,
} from "@/types/display-types";
import type { SprintViewState } from "../types";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";

interface UseSprintDataProps {
  workspace: WorkspaceBase;
  space: SpaceBase;
  sprintFolder: SprintFolderBase;
  sprint: SprintBase;
  initialTasks: Task[];
  initialStatuses: Status[];
  initialTags: Tag[];
}

export function useSprintData({
  workspace,
  space,
  sprintFolder,
  sprint,
  initialTasks,
  initialStatuses,
  initialTags,
}: UseSprintDataProps) {
  const { toast } = useEnhancedToast();
  const [supabase] = useState(() => createClientSupabaseClient());
  // BUG FIX #3: Track consecutive errors to avoid toast spam, only notify on first failure
  const refreshErrorCount = useRef(0);
  const [state, setState] = useState<SprintViewState>({
    view: "board",
    activeViews: ["board", "list"],
    tasks: initialTasks,
    statuses: initialStatuses,
    tags: initialTags,
    statusTypes: [],
    activeTask: null,
    activeStatus: null,
    expandedTasks: new Set(),
    collapsedStatuses: new Set(),
    visibleColumns: new Set(["assignee", "dueDate", "priority", "subtasks"]),
    allSubtasks: [],
    workspaceMembers: [],
    teamMembers: [],
    isLoading: false,
    taskToDelete: null,
    sprintToDelete: null,
    createTaskModalOpen: false,
    createStatusModalOpen: false,
    customizeListModalOpen: false,
    subtaskParentId: undefined,
    // Sprint action modals
    renameSprintModalOpen: false,
    moveSprintModalOpen: false,
    sprintInfoModalOpen: false,
    statusSettingsModalOpen: false,
    statusToEdit: null,
    filters: {
      status: [],
      tags: [],
      priority: [],
      assigned: [],
      sprintPoints: { min: 0, max: 100 },
      showUnassignedOnly: false,
    },
    filterModalOpen: false,
  });

  const updateState = useCallback((updates: Partial<SprintViewState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const refreshTasks = useCallback(async () => {
    try {
      // Simplified query to avoid schema cache issues with nested joins
      const { data: tasksData } = await supabase
        .from("tasks")
        .select(
          `
          *,
          assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url),
          created_by_profile:profiles!tasks_created_by_fkey(id, full_name, avatar_url),
          status:statuses(*),
          task_tags(tag:tags(*))
        `
        )
        .eq("sprint_id", sprint.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .returns<Task[]>();

      if (tasksData) {
        refreshErrorCount.current = 0;
        updateState({ tasks: tasksData as Task[] });
      }
    } catch (error) {
      // BUG FIX #3: Surface refresh errors to user (once, not on every retry)
      if (refreshErrorCount.current === 0) {
        toast({ title: "Sync issue", description: "Failed to refresh tasks. Board may be stale.", variant: "destructive" });
      }
      refreshErrorCount.current++;
    }
  }, [supabase, sprint.id, updateState, toast]);

  const refreshStatuses = useCallback(async () => {
    try {
      const { data: statusesData } = await supabase
        .from("statuses")
        .select(
          `
          *,
          status_type:status_types!statuses_status_type_id_fkey(*)
        `
        )
        .eq("workspace_id", workspace.id)
        .eq("type", "space")
        .is("deleted_at", null)
        .eq("space_id", space.id)
        .order("position", { ascending: true })
        .returns<Status[]>();

      if (statusesData) {
        updateState({ statuses: statusesData });
      }
    } catch (error) {
      console.error("[useSprintData] refreshStatuses error:", error);
    }
  }, [supabase, workspace.id, space.id, updateState]);

  const loadAllSubtasks = useCallback(async () => {
    try {
      // Simplified query to avoid schema cache issues with nested joins
      const { data: subtasksData } = await supabase
        .from("tasks")
        .select(
          `
          *,
          assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url),
          created_by_profile:profiles!tasks_created_by_fkey(id, full_name, avatar_url),
          status:statuses(*),
          task_tags(tag:tags(*))
        `
        )
        .eq("sprint_id", sprint.id)
        .not("parent_task_id", "is", null)
        .is("deleted_at", null)
        .returns<Task[]>();

      if (subtasksData) {
        updateState({ allSubtasks: subtasksData as Task[] });
      }
    } catch (error) {
      console.error("[useSprintData] loadAllSubtasks error:", error);
    }
  }, [supabase, sprint.id, updateState]);

  // PHASE_5_NOOP: was multi-user member fetch — fetch only the workspace owner's profile
  const fetchWorkspaceMembers = useCallback(async () => {
    if (!workspace?.owner_id) {
      updateState({ workspaceMembers: [] });
      return;
    }
    try {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email")
        .eq("id", workspace.owner_id)
        .maybeSingle();

      updateState({
        workspaceMembers: ownerProfile ? [ownerProfile as Profile] : [],
      });
    } catch (error) {
      console.error("Error fetching workspace owner profile:", error);
    }
  }, [workspace?.owner_id, supabase, updateState]);

  const fetchStatusTypes = useCallback(async () => {
    try {
      const { data: statusTypes } = await supabase
        .from("status_types")
        .select("*")
        .order("name", { ascending: true });

      if (statusTypes) {
        updateState({ statusTypes });
      }
    } catch (error) {
    }
  }, [supabase, updateState]);

  // PHASE_5_NOOP: was multi-user team-member fetch, OSS is single-user
  const fetchTeamMembers = useCallback(async () => {
    updateState({ teamMembers: [] });
  }, [updateState]);

  // Load workspace members
  useEffect(() => {
    fetchWorkspaceMembers();
  }, [fetchWorkspaceMembers]);

  // Load team members
  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  // Load status types
  useEffect(() => {
    fetchStatusTypes();
  }, [fetchStatusTypes]);

  // Load all subtasks on mount
  useEffect(() => {
    loadAllSubtasks();
  }, [loadAllSubtasks]);

  return {
    state,
    updateState,
    supabase,
    refreshTasks,
    refreshStatuses,
    loadAllSubtasks,
    fetchWorkspaceMembers,
    fetchStatusTypes,
    fetchTeamMembers,
  };
}
