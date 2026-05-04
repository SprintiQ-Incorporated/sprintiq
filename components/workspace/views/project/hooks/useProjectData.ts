import { useState, useEffect, useCallback } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import type {
  Workspace,
  Space,
  Project,
  Task,
  Status,
  Tag,
  Profile,
  Sprint,
  SprintFolder,
} from "@/lib/database-aliases";
import type { ViewMode, ProjectViewState } from "../types";

interface UseProjectDataProps {
  workspace: Workspace;
  space: Space;
  project: Project;
  initialTasks: Task[];
  initialStatuses: Status[];
  initialTags: Tag[];
  initialView?: ViewMode;
}

export const useProjectData = ({
  workspace,
  space,
  project,
  initialTasks,
  initialStatuses,
  initialTags,
  initialView,
}: UseProjectDataProps) => {
  // Create supabase client only on the client side
  const [supabase] = useState(() => createClientSupabaseClient());

  const [state, setState] = useState<ProjectViewState>({
    view: (initialView || "board") as ViewMode,
    activeViews: ["list", "board", "backlog", "sprints"] as ViewMode[],
    tasks: initialTasks,
    statuses: initialStatuses,
    tags: initialTags,
    statusTypes: [],
    activeTask: null,
    activeStatus: null,
    expandedTasks: new Set<string>(),
    collapsedStatuses: new Set<string>(),
    visibleColumns: new Set(["assignee", "dueDate", "priority", "subtasks"]),
    allSubtasks: [],
    workspaceMembers: [],
    teamMembers: [],
    isLoading: true,
    taskToDelete: null,
    createTaskModalOpen: false,
    createStatusModalOpen: false,
    customizeListModalOpen: false,
    subtaskParentId: undefined,
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
    // Sprint-related state
    sprints: [],
    sprintFolders: [],
    expandedSprints: new Set<string>(),
    createSprintModalOpen: false,
    sprintToEdit: null,
  });

  const updateState = useCallback((updates: Partial<ProjectViewState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const loadAllSubtasks = useCallback(async () => {
    try {
      
      // Fetch subtasks that belong to this project OR are in a sprint from this space
      const { data: subtasksData, error } = await supabase
        .from("tasks")
        .select(
          `
          *,
          assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url),
          created_by_profile:profiles!tasks_created_by_fkey(id, full_name, avatar_url),
          status:statuses(*),
          task_tags(
            tag:tags(*)
          )
        `
        )
        .or(`project_id.eq.${project.id},space_id.eq.${space.id}`)
        .not("parent_task_id", "is", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .returns<Task[]>();

      if (error) {
        console.error("Error loading subtasks:", error);
        return;
      }

      updateState({ allSubtasks: subtasksData || [] });
    } catch (error) {
      console.error("Error loading subtasks:", error);
    }
  }, [supabase, project.id, space.id, updateState]);

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

  // PHASE_5_NOOP: was multi-user team-member fetch, OSS is single-user
  const fetchTeamMembers = useCallback(async () => {
    updateState({ teamMembers: [] });
  }, [updateState]);

  const refreshTasks = useCallback(async () => {
    try {
      updateState({ isLoading: true });
      
      // Fetch tasks that belong to this project OR are in a sprint from this space
      // This handles orphaned tasks that lost their project_id but are still in sprints
      const { data: updatedTasks } = await supabase
        .from("tasks")
        .select(
          `
          *,
          assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url),
          created_by_profile:profiles!tasks_created_by_fkey(id, full_name, avatar_url),
          status:statuses(*),
          task_tags(
            tag:tags(*)
          )
        `
        )
        .or(`project_id.eq.${project.id},space_id.eq.${space.id}`)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .returns<Task[]>();

      if (updatedTasks) {
        updateState({ tasks: updatedTasks });
      }
    } catch (error) {
      console.error("Error refreshing tasks:", error);
    } finally {
      updateState({ isLoading: false });
    }
  }, [supabase, project.id, space.id, updateState]);

  const refreshStatuses = useCallback(async () => {
    try {
      const { data: updatedStatuses } = await supabase
        .from("statuses")
        .select(
          `
          *,
          status_type:status_types!statuses_status_type_id_fkey(*)
        `
        )
        .eq("workspace_id", workspace.id)
        .eq("type", "space")
        .eq("space_id", space.id)
        .is("deleted_at", null)
        .order("position", { ascending: true })
        .returns<Status[]>();

      if (updatedStatuses) {
        updateState({ statuses: updatedStatuses });
      }
    } catch (error) {
      console.error("Error refreshing statuses:", error);
    }
  }, [supabase, workspace.id, space.id, updateState]);

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
      console.error("Error fetching status types:", error);
    }
  }, [supabase, updateState]);

  const fetchSprints = useCallback(async () => {
    try {
      // Fetch sprint folders scoped to this project (or space-level folders with no project)
      const { data: sprintFoldersData, error: foldersError } = await supabase
        .from("sprint_folders")
        .select(
          `
          *,
          sprints(*)
        `
        )
        .eq("space_id", space.id)
        .or(`project_id.eq.${project.id},project_id.is.null`)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (foldersError) {
        console.error("Error fetching sprint folders:", foldersError);
        return;
      }

      // Extract all sprints from folders
      const allSprints: Sprint[] = [];
      const folders: SprintFolder[] = [];

      sprintFoldersData?.forEach((folder: any) => {
        folders.push(folder);
        if (folder.sprints) {
          // Filter out deleted sprints
          folder.sprints.forEach((sprint: any) => {
            if (!sprint.deleted_at) {
              allSprints.push(sprint);
            }
          });
        }
      });

      updateState({
        sprints: allSprints,
        sprintFolders: folders,
      });
    } catch (error) {
      console.error("Error fetching sprints:", error);
    }
  }, [supabase, space.id, project.id, updateState]);

  const refreshSprints = useCallback(async () => {
    await fetchSprints();
  }, [fetchSprints]);

  // Initialize data
  useEffect(() => {
    updateState({
      isLoading: true,
      tasks: initialTasks,
      statuses: initialStatuses,
      tags: initialTags,
      expandedTasks: new Set(),
      // teamMembers: [], // Initialize team members
    });
    setTimeout(() => updateState({ isLoading: false }), 300);
  }, [project.id, initialTasks, initialStatuses, initialTags, updateState]);

  useEffect(() => {
    loadAllSubtasks();
  }, [loadAllSubtasks]);

  useEffect(() => {
    fetchWorkspaceMembers();
  }, [fetchWorkspaceMembers]);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  useEffect(() => {
    fetchStatusTypes();
  }, [fetchStatusTypes]);

  useEffect(() => {
    fetchSprints();
  }, [fetchSprints]);

  // Fetch fresh tasks on mount to catch changes made while navigated away
  // (e.g., status changed on the task detail page)
  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  return {
    state,
    updateState,
    supabase,
    refreshTasks,
    refreshStatuses,
    loadAllSubtasks,
    fetchWorkspaceMembers,
    fetchStatusTypes,
    refreshSprints,
  };
};
