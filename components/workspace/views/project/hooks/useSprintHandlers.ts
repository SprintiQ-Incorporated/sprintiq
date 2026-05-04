import { useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sprint, Database, Workspace, Project } from "@/lib/database-aliases";
import type { ProjectViewState } from "../types";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";

interface UseSprintHandlersProps {
  state: ProjectViewState;
  updateState: (updates: Partial<ProjectViewState>) => void;
  supabase: SupabaseClient<Database>;
  refreshTasks: () => Promise<void>;
  refreshSprints: () => Promise<void>;
  workspace: Workspace;
  project: Project;
  setShowSprintAssistant: (show: boolean) => void;
  setSelectedStoriesForSprint: (taskIds: string[]) => void;
  onEditSprintName?: (sprint: Sprint) => void;
}

export const useSprintHandlers = ({
  state,
  updateState,
  supabase,
  refreshTasks,
  refreshSprints,
  workspace,
  project,
  setShowSprintAssistant,
  setSelectedStoriesForSprint,
  onEditSprintName,
}: UseSprintHandlersProps) => {
  const { toast } = useEnhancedToast();

  const handleToggleSprintExpand = useCallback(
    (sprintId: string) => {
      const newExpandedSprints = new Set(state.expandedSprints || new Set());
      if (newExpandedSprints.has(sprintId)) {
        newExpandedSprints.delete(sprintId);
      } else {
        newExpandedSprints.add(sprintId);
      }
      updateState({ expandedSprints: newExpandedSprints });
    },
    [state.expandedSprints, updateState]
  );

  const handleCreateSprint = useCallback(() => {
    // Open sprint assistant for now - can be replaced with a simple create sprint modal
    setShowSprintAssistant(true);
  }, [setShowSprintAssistant]);

  const handleCreateSprintFromStories = useCallback(
    (taskIds: string[]) => {
      setSelectedStoriesForSprint(taskIds);
      setShowSprintAssistant(true);
    },
    [setSelectedStoriesForSprint, setShowSprintAssistant]
  );

  const handleEditSprint = useCallback(
    (sprint: Sprint) => {
      if (onEditSprintName) {
        onEditSprintName(sprint);
      } else {
        // Fallback toast if no handler is provided
        toast({
          title: "Edit Sprint",
          description: `Editing sprint "${sprint.name}" - feature coming soon`,
        });
      }
    },
    [onEditSprintName, toast]
  );

  const handleDeleteSprint = useCallback(
    async (sprintId: string) => {
      try {
        // Move tasks back to project before deleting sprint
        const { error: moveError } = await supabase
          .from("tasks")
          .update({ sprint_id: null, project_id: project.id })
          .eq("sprint_id", sprintId);

        if (moveError) throw moveError;

        // Soft-delete the sprint (consistent with rest of application)
        const { error: deleteError } = await supabase
          .from("sprints")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", sprintId);

        if (deleteError) throw deleteError;

        toast({
          title: "Sprint deleted",
          description: "Tasks have been moved back to the project.",
        });

        // Refresh data
        await refreshSprints();
        await refreshTasks();
      } catch (error: any) {
        toast({
          title: "Error deleting sprint",
          description: error.message || "Failed to delete sprint",
          variant: "destructive",
        });
      }
    },
    [supabase, project.id, toast, refreshSprints, refreshTasks]
  );

  const handleMoveTaskToSprint = useCallback(
    async (taskId: string, sprintId: string | null) => {
      try {
        // Verify sprint exists if assigning to one
        if (sprintId) {
          const { data: sprint, error: sprintError } = await supabase
            .from("sprints")
            .select("id")
            .eq("id", sprintId)
            .maybeSingle();

          if (sprintError || !sprint) {
            toast({
              title: "Error",
              description: "Sprint not found",
              variant: "destructive",
            });
            return;
          }
        }

        const updateData: Record<string, any> = {
          sprint_id: sprintId,
          updated_at: new Date().toISOString(),
        };

        // If assigning to sprint, transition status from Backlog to the first active status (e.g. "In Progress")
        if (sprintId) {
          const activeStatus = state.statuses.find(
            (s: any) => s.status_type?.name === "active"
          );
          if (activeStatus?.id) {
            updateData.status_id = activeStatus.id;
          }
        }

        // DO NOT set project_id = null (task belongs to both project AND sprint)

        const { error } = await supabase
          .from("tasks")
          .update(updateData)
          .eq("id", taskId);

        if (error) throw error;

        toast({
          title: sprintId ? "Task added to sprint" : "Task removed from sprint",
          description: sprintId
            ? "Task has been moved to the sprint."
            : "Task has been moved back to Turbo Tasks.",
        });

        await refreshTasks();
      } catch (error: any) {
        toast({
          title: "Error moving task",
          description: error.message || "Failed to move task",
          variant: "destructive",
        });
      }
    },
    [supabase, workspace.id, project.id, toast, refreshTasks]
  );

  const handleStartSprint = useCallback(
    async (sprintId: string) => {
      try {
        const { error } = await supabase
          .from("sprints")
          .update({
            status: "active",
            start_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", sprintId);

        if (error) throw error;

        toast({
          title: "Sprint started",
          description: "The sprint has been started.",
        });

        await refreshSprints();
        await refreshTasks();
      } catch (error: any) {
        toast({
          title: "Error starting sprint",
          description: error.message || "Failed to start sprint",
          variant: "destructive",
        });
      }
    },
    [supabase, toast, refreshSprints, refreshTasks]
  );

  const handleCompleteSprint = useCallback(
    async (sprintId: string) => {
      try {
        const { error } = await supabase
          .from("sprints")
          .update({
            status: "completed",
            end_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", sprintId);

        if (error) throw error;

        toast({
          title: "Sprint completed",
          description: "The sprint has been marked as complete.",
        });

        await refreshSprints();
        await refreshTasks();
      } catch (error: any) {
        toast({
          title: "Error completing sprint",
          description: error.message || "Failed to complete sprint",
          variant: "destructive",
        });
      }
    },
    [supabase, toast, refreshSprints, refreshTasks]
  );

  const handleReorderBacklogTasks = useCallback(
    async (taskIds: string[]) => {
      try {
        // Update backlog_position for each task
        const updates = taskIds.map((id, index) =>
          supabase
            .from("tasks")
            .update({ backlog_position: index })
            .eq("id", id)
        );

        await Promise.all(updates);
        await refreshTasks();
      } catch (error: any) {
        toast({
          title: "Error reordering tasks",
          description: error.message || "Failed to reorder backlog",
          variant: "destructive",
        });
      }
    },
    [supabase, refreshTasks, toast]
  );

  return {
    handleToggleSprintExpand,
    handleCreateSprint,
    handleCreateSprintFromStories,
    handleEditSprint,
    handleDeleteSprint,
    handleMoveTaskToSprint,
    handleStartSprint,
    handleCompleteSprint,
    handleReorderBacklogTasks,
  };
};
