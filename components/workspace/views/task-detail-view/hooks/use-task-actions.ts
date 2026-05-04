/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { priorityConfig } from "../../project/types";
import type {
  Task,
  Status,
  Workspace,
  Space,
  Project,
  Tag as TagType,
  Sprint,
} from "@/lib/database-aliases";
import {
  generateTaskId,
  copyToClipboard,
  formatTaskAsMarkdown,
} from "../utils";
import { csrfFetch } from "@/hooks/useCsrfFetch";

export const useTaskActions = (
  initialTask: Task,
  workspace: Workspace,
  space: Space,
  project: Project | null,
  statuses: Status[],
  tags: TagType[],
  onTaskUpdate: (updatedTask: Task) => void,
  subtasks: Task[] = [],
  sprint: Sprint | null = null
) => {
  const [loading, setLoading] = useState(false);
  const supabase = createClientSupabaseClient();
  const router = useRouter();
  const { toast } = useEnhancedToast();

  const handleUpdateStatus = async (statusId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status_id: statusId })
        .eq("id", initialTask.id);

      if (error) {
        console.error("Error updating status:", error);
        toast({
          title: "Error",
          description: "Failed to update status",
          variant: "destructive",
        });
        return;
      }

      const updatedStatus = statuses.find((s) => s.id === statusId);
      const updatedTask = {
        ...initialTask,
        status_id: statusId,
        status: updatedStatus || initialTask.status,
      };
      onTaskUpdate(updatedTask);

      toast({
        title: "Success",
        description: `Status updated to "${updatedStatus?.name || "Unknown"}"`,
      });

      // Notify any mounted project views to refresh their task data
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("projectDataRefresh"));
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePriority = async (priority: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ priority: priority || undefined })
        .eq("id", initialTask.id);

      if (error) {
        console.error("Error updating priority:", error);
        toast({
          title: "Error",
          description: "Failed to update priority",
          variant: "destructive",
        });
        return;
      }

      const updatedTask = {
        ...initialTask,
        priority: priority || "medium",
      } as Task;
      onTaskUpdate(updatedTask);

      const priorityLabel = priority
        ? priorityConfig[priority as keyof typeof priorityConfig]?.label
        : "No priority";

      toast({
        title: "Success",
        description: `Priority updated to "${priorityLabel}"`,
      });
    } catch (error) {
      console.error("Error updating priority:", error);
      toast({
        title: "Error",
        description: "Failed to update priority",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStartDate = async (date: Date | undefined) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ start_date: date ? date.toISOString() : null })
        .eq("id", initialTask.id);

      if (error) {
        console.error("Error updating start date:", error);
        toast({
          title: "Error",
          description: "Failed to update start date",
          variant: "destructive",
        });
        return;
      }

      const updatedTask = {
        ...initialTask,
        start_date: date ? date.toISOString() : null,
      };
      onTaskUpdate(updatedTask);

      toast({
        title: "Success",
        description: "Start date updated successfully",
      });
    } catch (error) {
      console.error("Error updating start date:", error);
      toast({
        title: "Error",
        description: "Failed to update start date",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDueDate = async (date: Date | undefined) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ due_date: date ? date.toISOString() : null })
        .eq("id", initialTask.id);

      if (error) {
        console.error("Error updating due date:", error);
        toast({
          title: "Error",
          description: "Failed to update due date",
          variant: "destructive",
        });
        return;
      }

      const updatedTask = {
        ...initialTask,
        due_date: date ? date.toISOString() : null,
      };
      onTaskUpdate(updatedTask);

      toast({
        title: "Success",
        description: "Due date updated successfully",
      });
    } catch (error) {
      console.error("Error updating due date:", error);
      toast({
        title: "Error",
        description: "Failed to update due date",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTimeEstimate = async (timeEstimate: number | null) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ estimated_time: timeEstimate })
        .eq("id", initialTask.id);

      if (error) {
        console.error("Error updating time estimate:", error);
        toast({
          title: "Error",
          description: "Failed to update time estimate",
          variant: "destructive",
        });
        return;
      }

      const updatedTask = {
        ...initialTask,
        estimated_time: timeEstimate,
      } as Task;
      onTaskUpdate(updatedTask);

      toast({
        title: "Success",
        description: timeEstimate
          ? `Time estimate set to ${timeEstimate} hours`
          : "Time estimate cleared",
      });
    } catch (error) {
      console.error("Error updating time estimate:", error);
      toast({
        title: "Error",
        description: "Failed to update time estimate",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStoryPoints = async (storyPoints: number | null) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ story_points: storyPoints })
        .eq("id", initialTask.id);

      if (error) {
        console.error("Error updating story points:", error);
        toast({
          title: "Error",
          description: "Failed to update story points",
          variant: "destructive",
        });
        return;
      }

      const updatedTask = {
        ...initialTask,
        story_points: storyPoints,
      } as Task;
      onTaskUpdate(updatedTask);

      toast({
        title: "Success",
        description: storyPoints
          ? `Story points set to ${storyPoints}`
          : "Story points cleared",
      });
    } catch (error) {
      console.error("Error updating story points:", error);
      toast({
        title: "Error",
        description: "Failed to update story points",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      const markdown = formatTaskAsMarkdown(
        initialTask,
        workspace,
        space,
        project,
        sprint,
        subtasks,
        statuses
      );
      const success = await copyToClipboard(markdown);
      if (success) {
        toast({
          title: "Success",
          description: "Task details copied to clipboard",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to copy task details",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error copying task details:", error);
      toast({
        title: "Error",
        description: "Failed to copy task details",
        variant: "destructive",
      });
    }
  };

  const handleCopyId = async () => {
    try {
      const success = await copyToClipboard(initialTask.task_id);
      if (success) {
        toast({
          title: "Success",
          description: "Task ID copied to clipboard",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to copy ID",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error copying ID:", error);
      toast({
        title: "Error",
        description: "Failed to copy ID",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTask = async () => {
    try {
      // Delete task tags
      const { error: tagError } = await supabase
        .from("task_tags")
        .delete()
        .eq("task_id", initialTask.id);

      if (tagError) {
        console.error("Error deleting task tags:", tagError);
      }

      // Delete the task
      const { error } = await supabase
        .from("tasks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", initialTask.id);

      if (error) {
        console.error("Error deleting task:", error);
        toast({
          title: "Error",
          description: "Failed to delete task",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Task deleted successfully",
      });

      // Navigate back with defensive check for missing IDs
      if (!space.space_id || !project?.project_id) {
        // Fall back to portfolio if we can't navigate to project
        router.push(`/${workspace.workspace_id}/portfolio`);
        return;
      }
      router.push(`/${workspace.workspace_id}/space/${space.space_id}/project/${project.project_id}`);
    } catch (error) {
      console.error("Error deleting task:", error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  const handleDuplicateTask = async () => {
    try {
      const newTaskId = generateTaskId();

      const { data: duplicatedTask, error } = await supabase
        .from("tasks")
        .insert({
          task_id: newTaskId,
          name: `${initialTask.name} (Copy)`,
          description: initialTask.description,
          project_id: initialTask.project_id,
          space_id: initialTask.space_id,
          workspace_id: initialTask.workspace_id,
          status_id: statuses[0]?.id,
          priority: initialTask.priority,
          due_date: initialTask.due_date,
          start_date: initialTask.start_date,
          assignee_id: initialTask.assignee_id,
        })
        .select()
        .single();

      if (error) {
        console.error("Error duplicating task:", error);
        toast({
          title: "Error",
          description: "Failed to duplicate task",
          variant: "destructive",
        });
        return;
      }

      // Duplicate task tags if any
      if (initialTask.task_tags && initialTask.task_tags.length > 0) {
        const tagInserts = initialTask.task_tags.map((taskTag: any) => ({
          task_id: duplicatedTask.id,
          tag_id: taskTag.tag.id,
        }));

        await supabase.from("task_tags").insert(tagInserts);
      }

      toast({
        title: "Success",
        description: "Task duplicated successfully",
      });

      window.location.href = `/${workspace.workspace_id}/task/${duplicatedTask.task_id}`;
    } catch (error) {
      console.error("Error duplicating task:", error);
      toast({
        title: "Error",
        description: "Failed to duplicate task",
        variant: "destructive",
      });
    }
  };

  return {
    loading,
    handleUpdateStatus,
    handleUpdatePriority,
    handleUpdateStartDate,
    handleUpdateDueDate,
    handleUpdateTimeEstimate,
    handleUpdateStoryPoints,
    handleCopyLink,
    handleCopyId,
    handleDeleteTask,
    handleDuplicateTask,
  };
};
