"use client";

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, react/no-unescaped-entities */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { csrfFetch } from "@/hooks/useCsrfFetch";

// Import hooks
import { useTaskData } from "./hooks/use-task-data";
import { useTaskActions } from "./hooks/use-task-actions";
import { useClaudeCodeSessions } from "./hooks/use-claude-code-sessions";

// Import components
import { TaskHeader } from "./components/task-header";
import { TaskProperties } from "./components/task-properties";
import { TaskDescription } from "./components/task-description";
import { SubtasksList } from "./components/subtasks-list";
import { StoryMetadata } from "./components/story-metadata";
import { SummaryBar } from "./components/summary-bar";
import { ClaudeCodeDialog } from "./components/claude-code-dialog";
import { ClaudeCodeConflictCard } from "./components/claude-code-conflict-card";
import { ClaudeCodeLateArrival } from "./components/claude-code-late-arrival";
import { ClaudeCodeSessionCard } from "./components/claude-code-session-card";
import { ClaudeCodeRecommendations } from "./components/claude-code-recommendations";
import { SessionHistoryModal } from "./components/session-history-modal";
import { MobileActionBar } from "./components/mobile-action-bar";

// Import hooks
import { useIsMobile } from "@/hooks/use-mobile";

// Import utilities
import {
  generateTaskId,
  generateTagId,
  getRandomTagColor,
  getCompletedStatus,
  getTodoStatus,
  formatTaskAsMarkdown,
} from "./utils";

import type { TaskDetailViewProps } from "./types";
import type { Task } from "@/lib/database-aliases";
import { DependenciesDisplay } from "@/components/workspace/ai/dependencies-display";
import { TaskStatusHistory } from "./components/task-status-history";
import { MoveTaskModal } from "@/components/workspace/modals/move-task-modal";

export default function TaskDetailView({
  task: initialTask,
  workspace,
  space,
  project,
  sprint,
  statuses,
  tags,
}: TaskDetailViewProps) {
  // State management
  const [task, setTask] = useState(initialTask);
  const [editedTask, setEditedTask] = useState(task);
  const [editedDescription, setEditedDescription] = useState(
    task.description || ""
  );
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  // Subtask state
  const [newSubtaskName, setNewSubtaskName] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);

  // Task name editing state
  const [isEditingTaskName, setIsEditingTaskName] = useState(false);
  const [editedTaskName, setEditedTaskName] = useState(task.name);

  // Delete task dialog
  const [showDeleteTaskDialog, setShowDeleteTaskDialog] = useState(false);

  // Move task modal
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  // General loading state
  const [loading, setLoading] = useState(false);

  // Claude Code dialog state
  const [showClaudeDialog, setShowClaudeDialog] = useState(false);
  const [showSessionHistory, setShowSessionHistory] = useState(false);

  // Hooks
  const router = useRouter();
  const isMobile = useIsMobile();
  const { toast } = useEnhancedToast();
  const supabase = createClientSupabaseClient();

  // Data fetching hook
  const {
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
  } = useTaskData(task, workspace);

  // Task actions hook
  const {
    loading: actionsLoading,
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
  } = useTaskActions(
    task,
    workspace,
    space,
    project,
    statuses,
    tags,
    setTask,
    subtasks,
    sprint
  );

  // Claude Code sessions hook
  const taskContext = useMemo(
    () => ({
      taskId: task.id,
      taskName: task.name,
      description: task.description,
      priority: task.priority,
      status: statuses.find((s) => s.id === task.status_id)?.name,
      workspace: workspace.name,
      space: space.name,
      project: project?.name,
    }),
    [task, workspace, space, project, statuses]
  );

  const taskMarkdown = useMemo(
    () => formatTaskAsMarkdown(task, workspace, space, project, sprint, subtasks, statuses),
    [task, workspace, space, project, sprint, subtasks, statuses]
  );

  const {
    sessions: claudeSessions,
    activeSessions: claudeActiveSessions,
    completedSessions: claudeCompletedSessions,
    latestSession: claudeLatestSession,
    hasActiveSessions: claudeHasActiveSessions,
    conflictSessions: claudeConflictSessions,
    lateArrivalSessions: claudeLateArrivalSessions,
    isCreating: isCreatingClaudeSession,
    isStopping: isStoppingClaudeSession,
    isResolving: isResolvingClaudeConflict,
    startSession: startClaudeSession,
    stopSession: stopClaudeSession,
    resolveConflict: resolveClaudeConflict,
    dismissLateArrival: dismissClaudeLateArrival,
  } = useClaudeCodeSessions({
    task,
    workspace,
    taskContext,
    onTaskUpdated: (updatedTask) => {
      // BUG FIX #5: Refresh task detail when CLI auto-applies changes
      setTask((prev) => ({ ...prev, ...updatedTask }));
      setEditedTask((prev) => ({ ...prev, ...updatedTask }));
    },
  });

  // Update loading state
  const isLoading = loading || actionsLoading;

  // Update states when task changes
  useEffect(() => {
    setEditedDescription(task.description || "");
    setEditedTaskName(task.name);
    setEditedTask(task);
  }, [task]);

  // Description handlers
  const handleStartEditDescription = () => {
    const currentDescription = task.description || "";
    setEditedDescription(currentDescription);
    setIsEditingDescription(true);
  };

  const handleSaveDescription = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ description: editedDescription })
        .eq("id", task.id);

      if (error) {
        console.error("Error updating description:", error);
        toast({
          title: "Error",
          description: "Failed to update description",
          variant: "destructive",
        });
        return;
      }

      const updatedTask = { ...task, description: editedDescription };
      setTask(updatedTask as unknown as Task);
      setEditedTask(updatedTask as unknown as Task);
      setIsEditingDescription(false);

      toast({
        title: "Success",
        description: "Description updated successfully",
      });
    } catch (error) {
      console.error("Error updating description:", error);
      toast({
        title: "Error",
        description: "Failed to update description",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDescription = () => {
    setEditedDescription(task.description || "");
    setIsEditingDescription(false);
  };

  // Task name handlers
  const handleEditTaskName = () => {
    setEditedTaskName(task.name);
    setIsEditingTaskName(true);
  };

  const handleSaveTaskName = async () => {
    if (!editedTaskName.trim() || editedTaskName.trim() === task.name) {
      setIsEditingTaskName(false);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ name: editedTaskName.trim() })
        .eq("id", task.id);

      if (error) {
        console.error("Error updating task name:", error);
        toast({
          title: "Error",
          description: "Failed to update task name",
          variant: "destructive",
        });
        return;
      }

      const updatedTask = { ...task, name: editedTaskName.trim() };
      setTask(updatedTask as unknown as Task);
      setEditedTask(updatedTask as unknown as Task);
      setIsEditingTaskName(false);

      toast({
        title: "Success",
        description: "Task name updated successfully",
      });
    } catch (error) {
      console.error("Error updating task name:", error);
      toast({
        title: "Error",
        description: "Failed to update task name",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTaskName = () => {
    setEditedTaskName(task.name);
    setIsEditingTaskName(false);
  };

  // Subtask handlers
  const handleAddSubtask = async () => {
    if (!newSubtaskName.trim()) return;

    setLoading(true);
    try {
      if (!statuses || statuses.length === 0) {
        console.error("No statuses available for subtask creation");
        toast({
          title: "Error",
          description: "No statuses available. Please try refreshing the page.",
          variant: "destructive",
        });
        return;
      }

      const subtaskId = generateTaskId();

      const { data: newSubtask, error } = await supabase
        .from("tasks")
        .insert({
          task_id: subtaskId,
          name: newSubtaskName,
          project_id: task.project_id,
          space_id: task.space_id,
          workspace_id: task.workspace_id,
          parent_task_id: task.id,
          status_id: statuses[0].id,
          priority: "medium",
        })
        .select(
          `
          *,
          assignee:profiles!tasks_assignee_id_fkey(*),
          status:statuses(*),
          task_tags(tag:tags(*))
        `
        )
        .single();

      if (error) {
        console.error("Error creating subtask:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to create subtask",
          variant: "destructive",
        });
        return;
      }

      setSubtasks([...subtasks, newSubtask as unknown as Task]);
      setNewSubtaskName("");
      setIsAddingSubtask(false);

      toast({
        title: "Success",
        description: "Subtask created successfully",
      });
    } catch (error) {
      console.error("Exception in handleAddSubtask:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create subtask",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSubtaskComplete = async (subtask: Task) => {
    const completedStatus = getCompletedStatus(statuses);
    const todoStatus = getTodoStatus(statuses);

    const newStatusId =
      subtask.status_id === completedStatus?.id
        ? todoStatus?.id
        : completedStatus?.id;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status_id: newStatusId })
        .eq("id", subtask.id);

      if (error) {
        console.error("Error updating subtask:", error);
        return;
      }

      setSubtasks(
        subtasks.map((st) =>
          st.id === subtask.id
            ? { ...st, status_id: newStatusId || st.status_id }
            : st
        )
      );
    } catch (error) {
      console.error("Error updating subtask:", error);
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", subtaskId);

      if (error) {
        console.error("Error deleting subtask:", error);
        toast({
          title: "Error",
          description: "Failed to delete subtask",
          variant: "destructive",
        });
        return;
      }

      setSubtasks(subtasks.filter((st) => st.id !== subtaskId));

      toast({
        title: "Success",
        description: "Subtask deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting subtask:", error);
      toast({
        title: "Error",
        description: "Failed to delete subtask",
        variant: "destructive",
      });
    }
  };

  // Subtask update handlers
  const updateSubtaskAssignee = async (
    subtaskId: string,
    assigneeId: string | null
  ) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ assignee_id: assigneeId })
        .eq("id", subtaskId);

      if (error) {
        console.error("Error updating subtask assignee:", error);
        toast({
          title: "Error",
          description: "Failed to update subtask assignee",
          variant: "destructive",
        });
        return;
      }

      const assignee = assigneeId
        ? workspaceMembers.find((m) => m.id === assigneeId)
        : null;
      setSubtasks(
        subtasks.map((st) =>
          st.id === subtaskId
            ? { ...st, assignee_id: assigneeId, assignee: assignee }
            : st
        )
      );

      const assigneeName = assignee?.full_name || "Unassigned";
      toast({
        title: "Success",
        description: `Subtask assignee updated to ${assigneeName}`,
      });
    } catch (error) {
      console.error("Error updating subtask assignee:", error);
      toast({
        title: "Error",
        description: "Failed to update subtask assignee",
        variant: "destructive",
      });
    }
  };

  const updateSubtaskPriority = async (subtaskId: string, priority: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ priority: priority || undefined })
        .eq("id", subtaskId);

      if (error) {
        console.error("Error updating subtask priority:", error);
        toast({
          title: "Error",
          description: "Failed to update subtask priority",
          variant: "destructive",
        });
        return;
      }

      const oldSubtask = subtasks.find((st) => st.id === subtaskId);
      setSubtasks(
        subtasks.map((st) =>
          st.id === subtaskId ? { ...st, priority: priority || "medium" } : st
        )
      );

      toast({
        title: "Success",
        description: "Subtask priority updated successfully",
      });
    } catch (error) {
      console.error("Error updating subtask priority:", error);
      toast({
        title: "Error",
        description: "Failed to update subtask priority",
        variant: "destructive",
      });
    }
  };

  const updateSubtaskDueDate = async (
    subtaskId: string,
    date: Date | undefined
  ) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ due_date: date ? date.toISOString() : null })
        .eq("id", subtaskId);

      if (error) {
        console.error("Error updating subtask due date:", error);
        toast({
          title: "Error",
          description: "Failed to update subtask due date",
          variant: "destructive",
        });
        return;
      }

      const oldSubtask = subtasks.find((st) => st.id === subtaskId);
      setSubtasks(
        subtasks.map((st) =>
          st.id === subtaskId
            ? { ...st, due_date: date ? date.toISOString() : null }
            : st
        )
      );

      const dateLabel = date ? format(date, "MMM d, yyyy") : "No due date";
      toast({
        title: "Success",
        description: `Subtask due date updated to ${dateLabel}`,
      });
    } catch (error) {
      console.error("Error updating subtask due date:", error);
      toast({
        title: "Error",
        description: "Failed to update subtask due date",
        variant: "destructive",
      });
    }
  };

  // Assignee handlers — OSS is single-user; assignment uses profile only
  const addAssignee = async (memberId: string) => {
    try {
      const member = workspaceMembers.find((m) => m.id === memberId);
      const memberName = member?.full_name || "Unknown";

      if (!member) {
        toast({
          title: "Error",
          description: "User not found",
          variant: "destructive",
        });
        return;
      }

      const isAlreadyAssigned = taskAssignees.some(
        (assignee) => assignee.id === memberId
      );
      if (isAlreadyAssigned) {
        toast({
          title: "Info",
          description: "User is already assigned to this task",
        });
        return;
      }

      const { error } = await supabase
        .from("tasks")
        .update({ assignee_id: memberId })
        .eq("id", task.id);

      if (error) {
        console.error("Error adding assignee:", error);
        toast({
          title: "Error",
          description: "Failed to assign user to task",
          variant: "destructive",
        });
        return;
      }

      setTaskAssignees([{ id: memberId, full_name: memberName, type: "profile" }]);

      const updatedTask = {
        ...task,
        assignee_id: memberId,
        assignee: member,
      };
      setTask(updatedTask as unknown as Task);
      setEditedTask(updatedTask as unknown as Task);

      toast({
        title: "Success",
        description: `${memberName} assigned to task`,
      });
    } catch (error) {
      console.error("Error adding assignee:", error);
      toast({
        title: "Error",
        description: "Failed to assign user to task",
        variant: "destructive",
      });
    }
  };

  const removeAssignee = async (memberId: string) => {
    try {
      const member = taskAssignees.find((assignee) => assignee.id === memberId);
      if (!member) return;

      const { error } = await supabase
        .from("tasks")
        .update({ assignee_id: null })
        .eq("id", task.id);

      if (error) {
        console.error("Error removing assignee:", error);
        toast({
          title: "Error",
          description: "Failed to remove assignee from task",
          variant: "destructive",
        });
        return;
      }

      setTaskAssignees([]);
      const updatedTask = {
        ...task,
        assignee_id: null,
        assignee: null,
      };
      setTask(updatedTask as unknown as Task);
      setEditedTask(updatedTask as unknown as Task);

      const memberName = member.full_name || member.name || "Unknown";
      toast({
        title: "Success",
        description: `${memberName} removed from task`,
      });
    } catch (error) {
      console.error("Error removing assignee:", error);
      toast({
        title: "Error",
        description: "Failed to remove assignee from task",
        variant: "destructive",
      });
    }
  };

  // Tag handlers
  const addTagToTask = async (tagId: string) => {
    try {
      const isAlreadyAssigned = task.task_tags?.some(
        (taskTag: any) => taskTag.tag.id === tagId
      );
      if (isAlreadyAssigned) {
        toast({
          title: "Info",
          description: "Tag is already assigned to this task",
        });
        return;
      }

      const { error } = await supabase.from("task_tags").insert({
        task_id: task.id,
        tag_id: tagId,
      });

      if (error) {
        console.error("Error adding tag:", error);
        toast({
          title: "Error",
          description: "Failed to add tag to task",
          variant: "destructive",
        });
        return;
      }

      const { data: updatedTask, error: taskError } = await supabase
        .from("tasks")
        .select(
          `
          *,
          assignee:profiles!tasks_assignee_id_fkey(*),
          status:statuses(*),
          task_tags(tag:tags(*))
        `
        )
        .eq("id", task.id)
        .maybeSingle();

      if (taskError) {
        console.error("Error reloading task:", taskError);
        return;
      }

      setTask(updatedTask as unknown as Task);
      setEditedTask(updatedTask as unknown as Task);

      const addedTag = tags.find((tag) => tag.id === tagId);

      toast({
        title: "Success",
        description: `Tag "${addedTag?.name}" added to task`,
      });
    } catch (error) {
      console.error("Error adding tag:", error);
      toast({
        title: "Error",
        description: "Failed to add tag to task",
        variant: "destructive",
      });
    }
  };

  const removeTagFromTask = async (tagId: string) => {
    try {
      const removedTag = tags.find((tag) => tag.id === tagId);

      const { error } = await supabase
        .from("task_tags")
        .delete()
        .eq("task_id", task.id)
        .eq("tag_id", tagId);

      if (error) {
        console.error("Error removing tag:", error);
        toast({
          title: "Error",
          description: "Failed to remove tag from task",
          variant: "destructive",
        });
        return;
      }

      const updatedTaskTags =
        task.task_tags?.filter((taskTag: any) => taskTag.tag.id !== tagId) ||
        [];
      const updatedTask = {
        ...task,
        task_tags: updatedTaskTags,
      };
      setTask(updatedTask as unknown as Task);
      setEditedTask(updatedTask as unknown as Task);

      toast({
        title: "Success",
        description: `Tag "${removedTag?.name}" removed from task`,
      });
    } catch (error) {
      console.error("Error removing tag:", error);
      toast({
        title: "Error",
        description: "Failed to remove tag from task",
        variant: "destructive",
      });
    }
  };

  const createAndAssignNewTag = async (tagName: string) => {
    if (!tagName.trim()) return;

    try {
      const existingTag = tags.find(
        (tag) =>
          tag.name.toLowerCase() === tagName.trim().toLowerCase() &&
          tag.workspace_id === workspace.id
      );

      if (existingTag) {
        toast({
          title: "Tag already exists",
          description: `A tag named "${tagName.trim()}" already exists in this workspace`,
          variant: "destructive",
        });
        return;
      }

      const { data: existingTags, error: checkError } = await supabase
        .from("tags")
        .select("id, name")
        .eq("workspace_id", workspace.id)
        .is("deleted_at", null)
        .ilike("name", tagName.trim());

      if (checkError) {
        console.error("Error checking existing tags:", checkError);
        toast({
          title: "Error",
          description: "Failed to check for existing tags",
          variant: "destructive",
        });
        return;
      }

      if (existingTags && existingTags.length > 0) {
        toast({
          title: "Tag already exists",
          description: `A tag named "${tagName.trim()}" already exists in this workspace`,
          variant: "destructive",
        });
        return;
      }

      const tagId = generateTagId();
      const randomColor = getRandomTagColor();

      const { data: newTag, error: tagError } = await supabase
        .from("tags")
        .insert({
          tag_id: tagId,
          name: tagName.trim(),
          color: randomColor,
          workspace_id: workspace.id,
        })
        .select()
        .single();

      if (tagError) {
        console.error("Error creating tag:", tagError);
        if (tagError.code === "23505") {
          toast({
            title: "Tag already exists",
            description: `A tag named "${tagName.trim()}" already exists in this workspace`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to create new tag",
            variant: "destructive",
          });
        }
        return;
      }

      const { error: assignError } = await supabase.from("task_tags").insert({
        task_id: task.id,
        tag_id: newTag.id,
      });

      if (assignError) {
        console.error("Error assigning new tag:", assignError);
        toast({
          title: "Error",
          description: "Failed to assign new tag to task",
          variant: "destructive",
        });
        return;
      }

      const { data: updatedTask, error: taskError } = await supabase
        .from("tasks")
        .select(
          `
          *,
          assignee:profiles!tasks_assignee_id_fkey(*),
          status:statuses(*),
          task_tags(tag:tags(*))
        `
        )
        .eq("id", task.id)
        .maybeSingle();

      if (taskError) {
        console.error("Error reloading task:", taskError);
        return;
      }

      setTask(updatedTask as unknown as Task);
      setEditedTask(updatedTask as unknown as Task);

      toast({
        title: "Success",
        description: `Created and assigned tag "${tagName}"`,
      });
    } catch (error) {
      console.error("Error creating and assigning tag:", error);
      toast({
        title: "Error",
        description: "Failed to create and assign new tag",
        variant: "destructive",
      });
    }
  };

  // Other handlers
  const handleBack = () => {
    router.back();
  };

  const handleMoveTask = () => {
    setIsMoveModalOpen(true);
  };

  const completedSubtasks = subtasks.filter((st) => {
    const completedStatus = getCompletedStatus(statuses);
    return st.status_id === completedStatus?.id;
  }).length;

  return (
    <div className="flex flex-col h-full workspace-header-bg">
      {/* Header */}
      <TaskHeader
        task={task}
        workspace={workspace}
        space={space}
        project={project}
        sprint={sprint}
        onBack={handleBack}
        onEditTaskName={handleEditTaskName}
        onMoveTask={handleMoveTask}
        onDuplicateTask={handleDuplicateTask}
        onCopyLink={handleCopyLink}
        onCopyId={handleCopyId}
        onDeleteTask={() => setShowDeleteTaskDialog(true)}
      />

      {/* Sticky Summary Bar with key fields */}
      <SummaryBar
        task={task}
        statuses={statuses.filter(
          (status) =>
            (status.type === "project" && project && status.project_id === project.id) ||
            (status.type === "space" && status.space_id === space.id) ||
            (status.type === "sprint" && sprint && status.sprint_id === sprint.id)
        )}
        taskAssignees={taskAssignees}
        workspaceMembers={workspaceMembers}
        teamMembers={teamMembers}
        loading={isLoading}
        onUpdateStatus={handleUpdateStatus}
        onUpdatePriority={handleUpdatePriority}
        onUpdateDueDate={handleUpdateDueDate}
        onAddAssignee={addAssignee}
        onRemoveAssignee={removeAssignee}
        onEditTaskName={handleEditTaskName}
        onAddSubtask={() => setIsAddingSubtask(true)}
        onShare={handleCopyLink}
        onCodeWithClaude={() => {
          setShowClaudeDialog(true);
        }}
        claudeSessionActive={claudeHasActiveSessions}
      />

      <div className={`flex ${isMobile ? 'flex-col' : ''} flex-1 overflow-hidden workspace-header-bg`}>
        {/* Left Sidebar - Properties (Desktop only) */}
        <TaskProperties
          task={task}
          statuses={statuses}
          tags={tags}
          workspaceMembers={workspaceMembers}
          teamMembers={teamMembers}
          taskAssignees={taskAssignees}
          workspace={workspace}
          project={project}
          sprint={sprint}
          space={space}
          loading={isLoading}
          onUpdateStatus={handleUpdateStatus}
          onUpdatePriority={handleUpdatePriority}
          onUpdateStartDate={handleUpdateStartDate}
          onUpdateDueDate={handleUpdateDueDate}
          onUpdateTimeEstimate={handleUpdateTimeEstimate}
          onUpdateStoryPoints={handleUpdateStoryPoints}
          onAddAssignee={addAssignee}
          onRemoveAssignee={removeAssignee}
          onAddTag={addTagToTask}
          onRemoveTag={removeTagFromTask}
          onCreateAndAssignTag={createAndAssignNewTag}
        />

        {/* Main Content */}
        <div className={`flex-1 flex ${isMobile ? 'flex-col' : ''} overflow-hidden`}>
          {/* Task Description and Content */}
          <div className={`flex-1 overflow-y-auto ${isMobile ? 'pb-24' : ''}`}>
            <TaskDescription
              task={task}
              editedDescription={editedDescription}
              isEditingDescription={isEditingDescription}
              isEditingTaskName={isEditingTaskName}
              editedTaskName={editedTaskName}
              loading={isLoading}
              onStartEdit={handleStartEditDescription}
              onSave={handleSaveDescription}
              onCancel={handleCancelDescription}
              onDescriptionChange={setEditedDescription}
              onEditTaskName={handleEditTaskName}
              onSaveTaskName={handleSaveTaskName}
              onCancelTaskName={handleCancelTaskName}
              onTaskNameChange={setEditedTaskName}
            >
              {/* Story-specific metadata */}
              <StoryMetadata
                task={task}
                workspaceMembers={workspaceMembers}
                teamMembers={teamMembers}
              />

              {/* Claude Code Session Status */}
              <ClaudeCodeSessionCard
                sessions={claudeSessions}
                activeSessions={claudeActiveSessions}
                workspaceMembers={workspaceMembers}
                onViewHistory={() => setShowSessionHistory(true)}
                onCreateSubtask={(name) => {
                  setNewSubtaskName(name);
                  setIsAddingSubtask(true);
                }}
              />

              {/* Claude Code Recommendations */}
              <ClaudeCodeRecommendations taskId={task.id} />

              {/* Subtasks */}
              <SubtasksList
                subtasks={subtasks}
                statuses={statuses}
                workspaceMembers={workspaceMembers}
                workspace={workspace}
                completedSubtasks={completedSubtasks}
                isAddingSubtask={isAddingSubtask}
                newSubtaskName={newSubtaskName}
                loading={isLoading}
                deleteDialogOpen={deleteDialogOpen}
                onAddSubtask={() => setIsAddingSubtask(true)}
                onToggleAddSubtask={setIsAddingSubtask}
                onNewSubtaskNameChange={setNewSubtaskName}
                onHandleAddSubtask={handleAddSubtask}
                onToggleSubtaskComplete={toggleSubtaskComplete}
                onDeleteSubtask={deleteSubtask}
                onUpdateSubtaskAssignee={updateSubtaskAssignee}
                onUpdateSubtaskPriority={updateSubtaskPriority}
                onUpdateSubtaskDueDate={updateSubtaskDueDate}
                onSetDeleteDialogOpen={setDeleteDialogOpen}
              />

              {/* Dependencies */}
              <div className="mt-6 px-4 md:px-6">
                <DependenciesDisplay
                  taskId={task.id}
                  taskName={task.name}
                  workspaceId={workspace.workspace_id}
                  showAIButton={false}
                />
              </div>

              {/* Claude Code Conflict Cards */}
              {claudeConflictSessions.length > 0 && (
                <div className="mt-6 px-4 md:px-6 space-y-3">
                  {claudeConflictSessions.map((session) => (
                    <ClaudeCodeConflictCard
                      key={session.id}
                      session={session}
                      onResolve={(resolution, fieldResolutions) =>
                        resolveClaudeConflict(session.id, resolution, fieldResolutions)
                      }
                      isResolving={isResolvingClaudeConflict}
                    />
                  ))}
                </div>
              )}

              {/* Claude Code Late Arrival Banners */}
              {claudeLateArrivalSessions.length > 0 && (
                <div className="mt-4 px-4 md:px-6 space-y-3">
                  {claudeLateArrivalSessions.map((session) => (
                    <ClaudeCodeLateArrival
                      key={session.id}
                      session={session}
                      onApply={() =>
                        resolveClaudeConflict(session.id, "apply_ai")
                      }
                      onDismiss={() => dismissClaudeLateArrival(session.id)}
                      isResolving={isResolvingClaudeConflict}
                    />
                  ))}
                </div>
              )}

              {/* Status History - for retrospectives */}
              <div className="mt-6 px-4 md:px-6">
                <TaskStatusHistory taskId={task.id} maxEntries={15} />
              </div>
            </TaskDescription>
          </div>
        </div>
      </div>

      {/* Mobile Floating Action Bar */}
      <MobileActionBar
        onAddSubtask={() => setIsAddingSubtask(true)}
        onEditTaskName={handleEditTaskName}
        onShare={handleCopyLink}
        onMoveTask={handleMoveTask}
        onDuplicateTask={handleDuplicateTask}
        onCopyLink={handleCopyLink}
        onCopyId={handleCopyId}
        onDeleteTask={() => setShowDeleteTaskDialog(true)}
      />

      {/* Delete Task Dialog */}
      <Dialog
        open={showDeleteTaskDialog}
        onOpenChange={(open) => setShowDeleteTaskDialog(open)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{task.name}"? This will also
              delete all subtasks and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteTaskDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                handleDeleteTask();
                setShowDeleteTaskDialog(false);
              }}
            >
              Delete Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Task Modal */}
      {isMoveModalOpen && (
        <MoveTaskModal
          isOpen={isMoveModalOpen}
          onClose={() => setIsMoveModalOpen(false)}
          taskIds={[task.id]}
          currentProjectId={task.project_id ?? undefined}
          workspace={workspace}
          onSuccess={() => {
            // Refresh task data or navigate to new location
            router.refresh();
          }}
        />
      )}

      {/* Claude Code Dialog */}
      <ClaudeCodeDialog
        open={showClaudeDialog}
        onOpenChange={setShowClaudeDialog}
        sessions={claudeSessions}
        activeSessions={claudeActiveSessions}
        isCreating={isCreatingClaudeSession}
        isStopping={isStoppingClaudeSession}
        onStartSession={startClaudeSession}
        onStopSession={stopClaudeSession}
        taskMarkdown={taskMarkdown}
      />

      {/* Session History Modal */}
      <SessionHistoryModal
        open={showSessionHistory}
        onOpenChange={setShowSessionHistory}
        sessions={claudeSessions}
        workspaceMembers={workspaceMembers}
        onCreateSubtask={(name) => {
          setNewSubtaskName(name);
          setIsAddingSubtask(true);
          setShowSessionHistory(false);
        }}
      />

    </div>
  );
}
