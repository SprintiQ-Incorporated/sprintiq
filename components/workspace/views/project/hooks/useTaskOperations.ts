import { useCallback } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import type { Active, Over } from "@dnd-kit/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task, Status, Profile, Workspace, Project, Database } from "@/lib/database-aliases";
import type { ProjectViewState } from "../types";
import { useUpdateTask } from "@/lib/hooks/use-query-hooks";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import { getCanonicalStatusName } from "../utils";

interface UseTaskOperationsProps {
  state: ProjectViewState;
  updateState: (updates: Partial<ProjectViewState>) => void;
  supabase: SupabaseClient<Database>;
  refreshTasks: () => Promise<void>;
  refreshStatuses: () => Promise<void>;
  loadAllSubtasks: () => Promise<void>;
  workspace: Workspace;
  project: Project;
}

export const useTaskOperations = ({
  state,
  updateState,
  supabase,
  refreshTasks,
  refreshStatuses,
  loadAllSubtasks,
  workspace,
  project,
}: UseTaskOperationsProps) => {
  const updateTaskMutation = useUpdateTask();
  const { toast } = useEnhancedToast();

  const handleTaskCreated = useCallback(
    async (task: Task) => {
      await refreshTasks();
      await loadAllSubtasks();

      // Dispatch custom event for sidebar synchronization
      window.dispatchEvent(
        new CustomEvent("taskCreated", {
          detail: { task, projectId: project.id },
        })
      );
    },
    [refreshTasks, loadAllSubtasks, project.id]
  );

  const handleStatusCreated = useCallback(async () => {
    await refreshStatuses();
    await refreshTasks();
  }, [refreshStatuses, refreshTasks]);

  const handleRenameTask = useCallback(
    async (taskId: string, newName: string) => {
      if (!newName.trim()) return;
      try {
        const { error } = await supabase
          .from("tasks")
          .update({ name: newName })
          .eq("id", taskId);
        if (error) {
          console.error("Error renaming task:", error);
        } else {
          // Update local state immediately for better UX
          updateState({
            tasks: state.tasks.map((task: Task) =>
              task.id === taskId ? { ...task, name: newName } : task
            ),
          });

          await refreshTasks();
        }
      } catch (error) {
        console.error("Error renaming task:", error);
      }
    },
    [
      supabase,
      refreshTasks,
      state.tasks,
      updateState,
    ]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      try {
        const task = state.tasks.find((t: Task) => t.id === taskId);
        const timeStamp = new Date().toISOString();
        if (!task) return;

        const { error } = await supabase
          .from("tasks")
          .update({ deleted_at: timeStamp })
          .eq("id", taskId);
        if (error) {
          console.error("Error deleting task:", error);
        } else {
          // Update local state immediately for better UX
          updateState({
            tasks: state.tasks.filter((t: Task) => t.id !== taskId),
          });

          await refreshTasks();
          await loadAllSubtasks();

          // Dispatch custom event for sidebar synchronization
          window.dispatchEvent(
            new CustomEvent("taskDeleted", {
              detail: { task, projectId: project.id },
            })
          );
        }
      } catch (error) {
        console.error("Error deleting task:", error);
      } finally {
        updateState({ taskToDelete: null });
      }
    },
    [
      supabase,
      refreshTasks,
      loadAllSubtasks,
      state.tasks,
      updateState,
      project.id,
    ]
  );

  const handleAssignTask = useCallback(
    async (taskId: string, assigneeId: string | null) => {
      try {
        const { error } = await supabase
          .from("tasks")
          .update({ assignee_id: assigneeId })
          .eq("id", taskId);

        if (error) {
          console.error("Error assigning task:", error);
        } else {
          // Update local state immediately for better UX
          const newAssignee =
            state.workspaceMembers.find((m: Profile) => m.id === assigneeId) ||
            null;

          updateState({
            tasks: state.tasks.map((task: Task) =>
              task.id === taskId
                ? {
                    ...task,
                    assignee_id: assigneeId,
                    assignee: newAssignee,
                  }
                : task
            ),
          });

          await refreshTasks();
        }
      } catch (error) {
        console.error("Error assigning task:", error);
      }
    },
    [
      supabase,
      refreshTasks,
      state.tasks,
      state.workspaceMembers,
      updateState,
    ]
  );

  const handleUpdatePriority = useCallback(
    async (taskId: string, priority: string | null) => {
      try {
        const { error } = await supabase
          .from("tasks")
          .update({ priority: priority ?? undefined })
          .eq("id", taskId);

        if (error) {
          console.error("Error updating task priority:", error);
        } else {
          // Update local state immediately for better UX
          updateState({
            tasks: state.tasks.map((task: Task) =>
              task.id === taskId ? { ...task, priority: priority || "" } : task
            ),
          });

          await refreshTasks();
        }
      } catch (error) {
        console.error("Error updating task priority:", error);
      }
    },
    [
      supabase,
      refreshTasks,
      state.tasks,
      updateState,
    ]
  );

  const handleUpdateDates = useCallback(
    async (taskId: string, startDate: Date | null, dueDate: Date | null) => {
      try {
        const { error } = await supabase
          .from("tasks")
          .update({
            start_date: startDate?.toISOString() || null,
            due_date: dueDate?.toISOString() || null,
          })
          .eq("id", taskId);

        if (error) {
          console.error("Error updating task dates:", error);
        } else {
          // Update local state immediately for better UX
          updateState({
            tasks: state.tasks.map((task: Task) =>
              task.id === taskId
                ? {
                    ...task,
                    start_date: startDate?.toISOString() || null,
                    due_date: dueDate?.toISOString() || null,
                  }
                : task
            ),
          });

          await refreshTasks();
        }
      } catch (error) {
        console.error("Error updating task dates:", error);
      }
    },
    [
      supabase,
      refreshTasks,
      state.tasks,
      updateState,
    ]
  );

  const handleRenameStatus = useCallback(
    async (statusId: string, newName: string) => {
      try {
        // Use direct Supabase call instead of API endpoint
        const { error } = await supabase
          .from("statuses")
          .update({ name: newName })
          .eq("id", statusId)
          .select()
          .single();

        if (error) {
          console.error("Supabase error:", error);
          throw new Error(`Failed to rename status: ${error.message}`);
        }

        updateState({
          statuses: state.statuses.map((status: Status) =>
            status.id === statusId ? { ...status, name: newName } : status
          ),
        });
      } catch (error) {
        console.error("Error renaming status:", error);
      }
    },
    [supabase, state.statuses, updateState]
  );

  const handleUpdateStatusSettings = useCallback(
    async (updatedStatus: Status) => {
      try {

        // Use direct Supabase call instead of API endpoint
        const { error } = await supabase
          .from("statuses")
          .update({
            name: updatedStatus.name,
            status_type_id: updatedStatus.status_type_id,
            color: updatedStatus.color,
            type: updatedStatus.type,
          })
          .eq("id", updatedStatus.id)
          .select()
          .single();

        if (error) {
          console.error("Supabase error:", error);
          throw new Error(`Failed to update status settings: ${error.message}`);
        }


        // Update local state
        updateState({
          statuses: state.statuses.map((status: Status) =>
            status.id === updatedStatus.id
              ? { ...status, ...updatedStatus }
              : status
          ),
        });
      } catch (error) {
        console.error("Error updating status settings:", error);
        throw error;
      }
    },
    [supabase, state.statuses, updateState]
  );

  const handleReorderStatus = useCallback(
    async (statusId: string, direction: "left" | "right") => {
      try {
        const currentIndex = state.statuses.findIndex((s: Status) => s.id === statusId);
        if (currentIndex === -1) return;

        const newIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= state.statuses.length) return;

        // Create new array with swapped positions
        const newStatuses = [...state.statuses];
        const temp = newStatuses[currentIndex];
        newStatuses[currentIndex] = newStatuses[newIndex];
        newStatuses[newIndex] = temp;

        // Update local state immediately
        updateState({ statuses: newStatuses });

        // Update positions in database
        const updates = newStatuses.map((status: Status, index: number) => ({
          id: status.id,
          status_id: status.status_id,
          name: status.name,
          color: status.color,
          position: index,
          workspace_id: status.workspace_id,
          project_id: status.project_id,
          space_id: status.space_id,
          sprint_id: status.sprint_id,
          status_type_id: status.status_type_id,
          type: status.type,
        }));

        const { error } = await supabase
          .from("statuses")
          .upsert(updates, { onConflict: "id" });

        if (error) {
          console.error("Error reordering status:", error);
          await refreshStatuses();
        }
      } catch (error) {
        console.error("Error reordering status:", error);
        await refreshStatuses();
      }
    },
    [state.statuses, updateState, supabase, refreshStatuses]
  );

  const handleDeleteStatusWithReassignment = useCallback(
    async (statusId: string, targetStatusId: string) => {
      try {
        const statusToDelete = state.statuses.find((s: Status) => s.id === statusId);
        const timestamp = new Date().toISOString();

        if (!statusToDelete) {
          console.error("Status not found:", statusId);
          return;
        }// Get tasks that use this status
        const tasksToReassign = state.tasks.filter(
          (t: Task) => t.status_id === statusId
        );


        // Move tasks to target status
        if (tasksToReassign.length > 0 && targetStatusId) {
          const taskIds = tasksToReassign.map((t: Task) => t.id);

          const { error: moveError } = await supabase
            .from("tasks")
            .update({
              status_id: targetStatusId,
              updated_at: timestamp,
            })
            .in("id", taskIds);

          if (moveError) {
            console.error("Error moving tasks:", moveError);
            throw moveError;
          }

        }

        // Delete the status
        const { error: statusError } = await supabase
          .from("statuses")
          .update({ deleted_at: timestamp })
          .eq("id", statusId);

        if (statusError) {
          console.error("Error deleting status:", statusError);
          throw statusError;
        }

        // Refresh data
        await refreshStatuses();
        await refreshTasks();

        // Dispatch custom event for sidebar synchronization
        window.dispatchEvent(
          new CustomEvent("statusDeleted", {
            detail: { statusId, projectId: project.id },
          })
        );
      } catch (error) {
        console.error("Error deleting status with reassignment:", error);
        throw error;
      }
    },
    [
      state.statuses,
      state.tasks,
      supabase,
      refreshStatuses,
      refreshTasks,
      project.id,
    ]
  );

  const handleAddStatus = useCallback(
    async (name: string) => {
      try {
        // Get the next position
        const maxPosition = state.statuses.reduce(
          (max: number, s: Status) => Math.max(max, s.position || 0),
          -1
        );

        const { error } = await supabase
          .from("statuses")
          .insert({
            name,
            color: "gray",
            position: maxPosition + 1,
            workspace_id: workspace.id,
            space_id: project.space_id,
            type: "space",
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating status:", error);
          throw error;
        }

        // Refresh statuses
        await refreshStatuses();
      } catch (error) {
        console.error("Error adding status:", error);
        throw error;
      }
    },
    [state.statuses, supabase, workspace.id, project.space_id, refreshStatuses]
  );

  const handleDeleteStatus = useCallback(
    async (statusId: string) => {
      try {
        const statusToDelete = state.statuses.find((s: Status) => s.id === statusId);
        const timestamp = new Date().toISOString();
        if (!statusToDelete) {
          console.error("Status not found:", statusId);
          return;
        }// Get tasks that use this status
        const tasksWithStatus = state.tasks.filter(
          (t: Task) => t.status_id === statusId
        );


        // Delete all tasks that use this status
        if (tasksWithStatus.length > 0) {
          const taskIds = tasksWithStatus.map((t: Task) => t.id);

          // First, delete task_tags that reference these tasks
          const { error: taskTagsError } = await supabase
            .from("task_tags")
            .delete()
            .in("task_id", taskIds);

          if (taskTagsError) {
            console.error("Error deleting task_tags:", taskTagsError);
            console.error("Error details:", {
              message: taskTagsError.message,
              details: taskTagsError.details,
              hint: taskTagsError.hint,
              code: taskTagsError.code,
            });
            throw taskTagsError;
          }

          // Update sprints that reference these tasks (set task_id to null)
          const { error: sprintsError } = await supabase
            .from("sprints")
            .update({ task_id: null })
            .in("task_id", taskIds);

          if (sprintsError) {
            console.error("Error updating sprints:", sprintsError);
            console.error("Error details:", {
              message: sprintsError.message,
              details: sprintsError.details,
              hint: sprintsError.hint,
              code: sprintsError.code,
            });
            throw sprintsError;
          }

          // Finally delete the tasks themselves
          const { error: tasksError } = await supabase
            .from("tasks")
            .update({ deleted_at: timestamp })
            .in("id", taskIds)
            .select();

          if (tasksError) {
            console.error("Error deleting tasks:", tasksError);
            console.error("Error details:", {
              message: tasksError.message,
              details: tasksError.details,
              hint: tasksError.hint,
              code: tasksError.code,
            });
            throw tasksError;
          }
        }

        // Delete the status
        const { error: statusError } = await supabase
          .from("statuses")
          .update({ deleted_at: timestamp })
          .eq("id", statusId)
          .select();

        if (statusError) {
          console.error("Error deleting status:", statusError);
          console.error("Error details:", {
            message: statusError.message,
            details: statusError.details,
            hint: statusError.hint,
            code: statusError.code,
          });
          throw statusError;
        }


        // Refresh data
        await refreshStatuses();
        await refreshTasks();
        await loadAllSubtasks();

        // Dispatch custom event for sidebar synchronization
        window.dispatchEvent(
          new CustomEvent("statusDeleted", {
            detail: { statusId, projectId: project.id },
          })
        );
      } catch (error) {
        console.error("Error deleting status:", error);
        console.error("Full error object:", JSON.stringify(error, null, 2));

        // Provide more specific error messages based on error type
        let _errorMessage = "Failed to delete status. Please try again.";
        if (error && typeof error === "object" && "message" in error) {
          const errorObj = error as any;
          if (errorObj.code === "23503") {
            _errorMessage =
              "Cannot delete status because it is still referenced by other data.";
          } else if (errorObj.message) {
            _errorMessage = errorObj.message;
          }
        }

        throw error;
      }
    },
    [
      state.statuses,
      state.tasks,
      supabase,
      refreshStatuses,
      refreshTasks,
      loadAllSubtasks,
      project.id,
    ]
  );

  const handleDragEnd = useCallback(
    async (active: Active, over: Over | null) => {if (!over) return;

      // Handle status reordering
      if (state.activeStatus) {const oldIndex = state.statuses.findIndex((s: Status) => s.id === active.id);

        // Handle the case where over.id has a "status-" prefix for droppable areas
        let targetStatusId = over.id;
        if (over.id.toString().startsWith("status-")) {
          targetStatusId = over.id.toString().replace("status-", "");
        }

        const newIndex = state.statuses.findIndex(
          (s: Status) => s.id === targetStatusId
        );if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {return;
        }

        const newOrderedStatuses = arrayMove(
          state.statuses,
          oldIndex,
          newIndex
        );updateState({ statuses: newOrderedStatuses });

        try {
          const updates = newOrderedStatuses.map((status: Status, index: number) => ({
            id: status.id,
            status_id: status.status_id,
            name: status.name,
            color: status.color,
            position: index,
            workspace_id: status.workspace_id,
            project_id: status.project_id,
            space_id: status.space_id,
            sprint_id: status.sprint_id,
            status_type_id: status.status_type_id,
            type: status.type,
          }));

          const { error } = await supabase
            .from("statuses")
            .upsert(updates, { onConflict: "id" });

          if (error) {
            console.error("Error updating status positions:", error);
            await refreshStatuses();
          }
        } catch (error) {
          console.error("Error updating status positions:", error);
          await refreshStatuses();
        }
        return;
      }

      // Handle task dragging
      if (state.activeTask) {const taskId = active.id as string;
        const task = state.tasks.find((t: Task) => t.id === taskId);

        if (!task || task.parent_task_id) {
          return;
        }

        let targetStatusId: string | null = null;

        const targetStatus = state.statuses.find((s: Status) => s.id === over.id);
        if (targetStatus) {
          targetStatusId = targetStatus.id;
        } else if (over.id.toString().startsWith("status-")) {
          const rawId = over.id.toString().replace("status-", "");
          if (rawId.startsWith("canonical-")) {
            // Placeholder column with no real status — resolve to first real status
            // that maps to this canonical name (e.g. "canonical-in-progress" → "In Progress")
            const canonicalName = rawId
              .replace("canonical-", "")
              .split("-")
              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");
            const realStatus = state.statuses.find(
              (s: Status) => getCanonicalStatusName(s) === canonicalName
            );
            targetStatusId = realStatus?.id ?? null;
          } else {
            targetStatusId = rawId;
          }
        } else {
          const targetTask = state.tasks.find((t: Task) => t.id === over.id);
          if (targetTask) {
            targetStatusId = targetTask.status_id;
          }
        }

        if (!targetStatusId || task.status_id === targetStatusId) {
          return;
        }

        try {
          const targetStatus = state.statuses.find(
            (s: Status) => s.id === targetStatusId
          );
          
          // Preserve the task's project_id - don't change it based on status
          // Statuses are space-level and don't have project_id set
          // If the task was in a sprint, also keep it in the project so it shows up
          const updateData: Partial<Database["public"]["Tables"]["tasks"]["Update"]> = {
            status_id: targetStatusId,
            space_id: targetStatus?.space_id ?? task.space_id ?? null,
          };

          // If task has a sprint_id but no project_id, add it back to the current project
          // This prevents orphaned tasks when moving sprint tasks between statuses
          if (task.sprint_id && !task.project_id) {
            updateData.project_id = project.project_id;
          }

          // React Query mutation handles optimistic update and rollback automatically
          await updateTaskMutation.mutateAsync({
            id: taskId,
            updates: updateData,
          });

          // Update local state immediately so UI reflects the change
          // This is critical because BoardView renders from state.tasks, not React Query cache
          updateState({
            tasks: state.tasks.map((t: Task) =>
              t.id === taskId ? { ...t, status_id: targetStatusId! } : t
            ),
          });

          // Note: Status history is automatically tracked by database trigger (task_status_change_trigger)
          // No manual insert needed - this prevents duplicate entries

        } catch (error) {
          console.error('[Project BoardView] Error updating task status:', {
            error,
            _errorMessage: error instanceof Error ? error.message : String(error),
            taskId,
            targetStatusId,
          });
          // React Query automatically reverted the optimistic update
          toast({
            title: "Error",
            description: "Failed to update task status. Please try again.",
            variant: "destructive",
          });
        }
      }
    },
    [
      state,
      updateState,
      supabase,
      refreshStatuses,
      refreshTasks,
      updateTaskMutation,
      project.project_id,
      toast,
    ]
  );

  return {
    handleTaskCreated,
    handleStatusCreated,
    handleRenameTask,
    handleDeleteTask,
    handleAssignTask,
    handleUpdatePriority,
    handleUpdateDates,
    handleRenameStatus,
    handleUpdateStatusSettings,
    handleDeleteStatus,
    handleDeleteStatusWithReassignment,
    handleReorderStatus,
    handleAddStatus,
    handleDragEnd,
  };
};
