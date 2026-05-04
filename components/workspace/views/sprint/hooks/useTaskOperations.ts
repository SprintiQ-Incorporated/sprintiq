/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
import { useCallback } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import type {
  Workspace,
  Space,
  Sprint,
  Task,
} from "@/lib/database-aliases";
import type { SprintViewState } from "../types";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import { arrayMove } from "@dnd-kit/sortable";
import { useUpdateTask } from "@/lib/hooks/use-query-hooks";

interface UseTaskOperationsProps {
  state: SprintViewState;
  updateState: (updates: Partial<SprintViewState>) => void;
  supabase: ReturnType<typeof createClientSupabaseClient>;
  refreshTasks: () => Promise<void>;
  refreshStatuses: () => Promise<void>;
  loadAllSubtasks: () => Promise<void>;
  workspace: Workspace;
  space: Space;
  sprint: Sprint;
}

export function useTaskOperations({
  state,
  updateState,
  supabase,
  refreshTasks,
  refreshStatuses,
  loadAllSubtasks,
  workspace,
  space,
  sprint,
}: UseTaskOperationsProps) {
  const { toast } = useEnhancedToast();
  const updateTaskMutation = useUpdateTask();

  const handleTaskCreated = useCallback(
    async (task: Task) => {
      await refreshTasks();
      await loadAllSubtasks();

      // Dispatch custom event for sidebar synchronization
      window.dispatchEvent(
        new CustomEvent("taskCreated", {
          detail: { task, sprintId: sprint.id },
        })
      );

      toast({
        title: "Task created",
        description: `Task "${task.name}" has been created successfully.`,
      });

      updateState({ createTaskModalOpen: false, subtaskParentId: undefined });
    },
    [
      refreshTasks,
      loadAllSubtasks,
      toast,
      updateState,
      sprint.id,
    ]
  );

  const handleStatusCreated = useCallback(async () => {
    await refreshStatuses();

    toast({
      title: "Status created",
      description: "New status has been created successfully.",
    });

    updateState({ createStatusModalOpen: false });
  }, [refreshStatuses, toast, updateState]);

  const handleRenameTask = useCallback(
    async (taskId: string, newName: string) => {
      try {
        const { error } = await supabase
          .from("tasks")
          .update({ name: newName })
          .eq("id", taskId);

        if (error) throw error;

        // Update local state immediately for better UX
        updateState({
          tasks: state.tasks.map((task) =>
            task.id === taskId ? { ...task, name: newName } : task
          ),
        });

        await refreshTasks();
        await loadAllSubtasks();

        toast({
          title: "Task renamed",
          description: "Task has been renamed successfully.",
        });
      } catch (error) {
        console.error("Error renaming task:", error);
        toast({
          title: "Error",
          description: "Failed to rename task.",
          variant: "destructive",
        });
      }
    },
    [
      supabase,
      refreshTasks,
      loadAllSubtasks,
      toast,
      updateState,
      state.tasks,
    ]
  );

  const handleUpdatePriority = useCallback(
    async (taskId: string, priority: string | null) => {
      try {
        const { error } = await supabase
          .from("tasks")
          .update({ priority: priority ?? undefined })
          .eq("id", taskId);

        if (error) throw error;

        // Update local state immediately for better UX
        updateState({
          tasks: state.tasks.map((task) =>
            task.id === taskId ? { ...task, priority: priority || "" } : task
          ),
        });

        await refreshTasks();
        await loadAllSubtasks();
      } catch (error) {
        console.error("Error updating task priority:", error);
        toast({
          title: "Error",
          description: "Failed to update task priority.",
          variant: "destructive",
        });
      }
    },
    [
      supabase,
      refreshTasks,
      loadAllSubtasks,
      toast,
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

        if (error) throw error;

        // Update local state immediately for better UX
        updateState({
          tasks: state.tasks.map((task) =>
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
        await loadAllSubtasks();
      } catch (error) {
        console.error("Error updating task dates:", error);
        toast({
          title: "Error",
          description: "Failed to update task dates.",
          variant: "destructive",
        });
      }
    },
    [
      supabase,
      refreshTasks,
      loadAllSubtasks,
      toast,
      state.tasks,
      updateState,
    ]
  );

  const handleAssignTask = useCallback(
    async (taskId: string, assigneeId: string | null) => {
      try {
        const { error } = await supabase
          .from("tasks")
          .update({ assignee_id: assigneeId })
          .eq("id", taskId);

        if (error) throw error;

        // Update local state immediately for better UX
        const newAssignee =
          state.workspaceMembers.find((m) => m.id === assigneeId) || null;

        updateState({
          tasks: state.tasks.map((task) =>
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
        await loadAllSubtasks();
      } catch (error) {
        console.error("Error assigning task:", error);
        toast({
          title: "Error",
          description: "Failed to assign task.",
          variant: "destructive",
        });
      }
    },
    [
      supabase,
      refreshTasks,
      loadAllSubtasks,
      toast,
      state.tasks,
      state.workspaceMembers,
      updateState,
    ]
  );

  const handleDeleteTask = useCallback(
    async (task: Task) => {
      try {
        const timestamp = new Date().toISOString();
        const { error } = await supabase
          .from("tasks")
          .update({ deleted_at: timestamp })
          .eq("id", task.id);

        if (error) throw error;

        // Update local state immediately for better UX
        updateState({
          tasks: state.tasks.filter((t) => t.id !== task.id),
        });

        await refreshTasks();
        await loadAllSubtasks();

        // Dispatch custom event for sidebar synchronization
        window.dispatchEvent(
          new CustomEvent("taskDeleted", {
            detail: { task, sprintId: sprint.id },
          })
        );

        toast({
          title: "Task deleted",
          description: "Task has been deleted successfully.",
        });
      } catch (error) {
        console.error("Error deleting task:", error);
        toast({
          title: "Error",
          description: "Failed to delete task.",
          variant: "destructive",
        });
      }
    },
    [
      supabase,
      refreshTasks,
      loadAllSubtasks,
      toast,
      updateState,
      state.tasks,
      sprint.id,
    ]
  );

  const handleRenameStatus = useCallback(
    async (statusId: string, newName: string) => {
      try {
        const { error } = await supabase
          .from("statuses")
          .update({ name: newName })
          .eq("id", statusId);

        if (error) throw error;

        await refreshStatuses();

        toast({
          title: "Status renamed",
          description: "Status has been renamed successfully.",
        });
      } catch (error) {
        console.error("Error renaming status:", error);
        toast({
          title: "Error",
          description: "Failed to rename status.",
          variant: "destructive",
        });
      }
    },
    [supabase, refreshStatuses, toast]
  );

  const handleUpdateStatusSettings = useCallback(
    async (updatedStatus: any) => {
      try {
        const { error } = await supabase
          .from("statuses")
          .update({
            name: updatedStatus.name,
            status_type_id: updatedStatus.status_type_id,
            color: updatedStatus.color,
            type: updatedStatus.type,
          })
          .eq("id", updatedStatus.id);

        if (error) throw error;

        await refreshStatuses();

        toast({
          title: "Status updated",
          description: `Status "${updatedStatus.name}" has been updated successfully.`,
        });
      } catch (error) {
        console.error("Error updating status settings:", error);
        toast({
          title: "Error",
          description: "Failed to update status settings.",
          variant: "destructive",
        });
        throw error;
      }
    },
    [supabase, refreshStatuses, toast]
  );

  const handleDragEnd = useCallback(
    async (active: any, over: any) => {

      if (!over) {
        return;
      }

      // Handle status reordering
      if (state.activeStatus) {
        const oldIndex = state.statuses.findIndex((s) => s.id === active.id);
        const newIndex = state.statuses.findIndex((s) => s.id === over.id);

        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

        const newOrderedStatuses = arrayMove(
          state.statuses,
          oldIndex,
          newIndex
        );

        updateState({ statuses: newOrderedStatuses });

        try {
          const updates = newOrderedStatuses.map((status, index) => ({
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
      if (state.activeTask) {
        const taskId = active.id as string;
        const task = state.tasks.find((t) => t.id === taskId);

        if (!task || task.parent_task_id) {
          return;
        }

        let targetStatusId: string | null = null;

        const targetStatus = state.statuses.find((s) => s.id === over.id);
        if (targetStatus) {
          targetStatusId = targetStatus.id;
        } else if (over.id.toString().startsWith("status-")) {
          targetStatusId = over.id.toString().replace("status-", "");
        } else {
          const targetTask = state.tasks.find((t) => t.id === over.id);
          if (targetTask) {
            targetStatusId = targetTask.status_id;
          }
        }

        if (!targetStatusId || task.status_id === targetStatusId) {
          return;
        }

        try {

          // React Query mutation handles optimistic update and rollback automatically
          const result = await updateTaskMutation.mutateAsync({
            id: taskId,
            updates: { status_id: targetStatusId },
          });

          // Update local state immediately so UI reflects the change
          // This is critical because BoardView renders from state.tasks, not React Query cache
          updateState({
            tasks: state.tasks.map((t) =>
              t.id === taskId ? { ...t, status_id: targetStatusId! } : t
            ),
          });

          // Note: Status history is automatically tracked by database trigger (task_status_change_trigger)
          // No manual insert needed - this prevents duplicate entries

        } catch (error) {
          console.error('[Sprint BoardView] Error updating task status:', {
            error,
            errorMessage: error instanceof Error ? error.message : String(error),
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
      loadAllSubtasks,
      updateTaskMutation,
      toast,
    ]
  );

  const handleDeleteStatus = useCallback(
    async (statusId: string) => {
      try {
        const statusToDelete = state.statuses.find((s) => s.id === statusId);
        if (!statusToDelete) {
          console.error("Status not found:", statusId);
          return;
        }

        const timestamp = new Date().toISOString();// Get tasks that use this status
        const tasksWithStatus = state.tasks.filter(
          (t) => t.status_id === statusId
        );


        // Delete all tasks that use this status
        if (tasksWithStatus.length > 0) {
          const taskIds = tasksWithStatus.map((t) => t.id);

          // First, delete task_tags that reference these tasks
          const { error: taskTagsError } = await supabase
            .from("task_tags")
            .update({ deleted_at: timestamp } as any)
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
          const { error: tasksError, data: deletedTasks } = await supabase
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
        const { error: statusError, data: deletedStatus } = await supabase
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
            detail: { statusId, sprintId: sprint.id },
          })
        );

        toast({
          title: "Status deleted",
          description: `Status "${statusToDelete.name}" and ${tasksWithStatus.length} tasks have been deleted.`,
        });
      } catch (error) {
        console.error("Error deleting status:", error);
        console.error("Full error object:", JSON.stringify(error, null, 2));

        // Provide more specific error messages based on error type
        let errorMessage = "Failed to delete status. Please try again.";
        if (error && typeof error === "object" && "message" in error) {
          const errorObj = error as any;
          if (errorObj.code === "23503") {
            errorMessage =
              "Cannot delete status because it is still referenced by other data.";
          } else if (errorObj.message) {
            errorMessage = errorObj.message;
          }
        }

        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
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
      sprint.id,
      toast,
    ]
  );

  return {
    handleTaskCreated,
    handleStatusCreated,
    handleRenameTask,
    handleUpdatePriority,
    handleUpdateDates,
    handleAssignTask,
    handleDeleteTask,
    handleRenameStatus,
    handleUpdateStatusSettings,
    handleDeleteStatus,
    handleDragEnd,
  };
}
