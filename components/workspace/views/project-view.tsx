"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  List,
  LayoutGrid,
  Filter,
  Settings,
  Users,
  CheckIcon,
  CircleUserRound,
  ChartGantt,
  Target,
  Folder,
  Save,
  Zap,
  Archive,
  Loader2,
  MoreHorizontal,
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
} from "@dnd-kit/core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { getAvatarInitials } from "@/lib/utils";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import CreateTaskModal from "@/components/workspace/modals/create-task-modal";
import CreateStatusModal from "@/components/workspace/modals/create-status-modal";
import CustomizeListModal from "@/components/workspace/modals/customize-list-modal";
import FilterModal from "@/components/workspace/modals/filter-modal";
import StatusSettingsModal from "@/components/workspace/modals/status-settings-modal";
import RenameSprintModal from "@/components/workspace/modals/rename-sprint-modal";
import { MoveTaskModal } from "@/components/workspace/modals/move-task-modal";

// Import Sprint Assistant components
import SprintAssistant from "@/components/workspace/ai/sprint-assistant";
import type { UserStory } from "@/types";
import {
  createSprintFolder,
  createSprints,
} from "@/app/[workspaceId]/actions";

// Import our custom hooks and components
import { useProjectData } from "./project/hooks/useProjectData";
import { useTaskOperations } from "./project/hooks/useTaskOperations";
import { useSprintHandlers } from "./project/hooks/useSprintHandlers";
import { useRealtimeSubscriptions } from "./project/hooks/useRealtimeSubscriptions";
import { TaskCard } from "./project/components/TaskCard";
import { StatusColumn } from "./project/components/StatusColumn";
import { ProjectHeader } from "./project/components/ProjectHeader";
import { BoardView } from "./project/views/BoardView";
import { ListView } from "./project/views/ListView";
import { SprintsView } from "./project/views/SprintsView";
import { BacklogView } from "./project/views/BacklogView";
import { ProjectModals } from "./project/modals/ProjectModals";
import type { ProjectViewProps, ViewMode } from "./project/types";
import { getSubtasksForTask, filterTasks, getCanonicalStatusName } from "./project/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
} from "@/components/ui/popover";
import { ArchiveConfirmationDialog } from "@/components/workspace/layout/secondary-sidebar/components/dialogs/archive-confirmation-dialog";
import { csrfFetch } from "@/hooks/useCsrfFetch";

export default function ProjectView({
  workspace,
  space,
  project,
  tasks: initialTasks,
  statuses: initialStatuses,
  tags: initialTags,
}: ProjectViewProps) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useEnhancedToast();
  const queryClient = useQueryClient();

  // Get initial view from URL query param (e.g., ?view=sprints)
  const initialView = searchParams.get("view") as "board" | "list" | "backlog" | "sprints" | null;

  // Project management state
  const [, setProjectFavorites] = useState<Set<string>>(new Set());
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  // Local project state for immediate UI updates
  const [localProject, setLocalProject] = useState(project);

  // Sprint Assistant state
  const [showSprintAssistant, setShowSprintAssistant] = useState(false);

  // Bulk-move modal state (invoked from BacklogView toolbar)
  const [bulkMoveTaskIds, setBulkMoveTaskIds] = useState<string[]>([]);
  const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);

  // Save Sprints Modal state
  const [showSaveSprintsModal, setShowSaveSprintsModal] = useState(false);
  const [sprintsToSave, setSprintsToSave] = useState<any[]>([]);
  const [sprintType, setSprintType] = useState<"ai" | "manual">("ai");
  const [sprintFolderName, setSprintFolderName] = useState("Sprint Plan");
  const [sprintFolders, setSprintFolders] = useState<any[]>([]);
  const [selectedSprintFolderId, setSelectedSprintFolderId] = useState<string>(
    "new"
  );
  const [isLoadingSprintFolders, setIsLoadingSprintFolders] = useState(false);
  
  // Create Sprint from Stories state (pre-selects stories in SprintAssistant)
  const [selectedStoriesForSprint, setSelectedStoriesForSprint] = useState<string[]>([]);

  // Rename Sprint state
  const [sprintToRename, setSprintToRename] = useState<any>(null);

  // Archive Sprint state
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveSprintTarget, setArchiveSprintTarget] = useState<any>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // AI Analysis Features state - managed by useAIToolHandlers hook (defined after filteredTasks)

  // Update local project when prop changes
  useEffect(() => {
    setLocalProject(project);
  }, [project]);

  // Load project favorites from localStorage
  React.useEffect(() => {
    const savedFavorites = localStorage.getItem(
      `project_favorites_${workspace.id}`
    );
    if (savedFavorites) {
      try {
        const favorites = JSON.parse(savedFavorites);
        setProjectFavorites(new Set(favorites));
      } catch (error) {
        console.error("Error loading project favorites:", error);
      }
    }
  }, [workspace.id]);

  // Custom hooks
  const {
    state,
    updateState,
    supabase,
    refreshTasks,
    refreshStatuses,
    loadAllSubtasks,
    refreshSprints,
  } = useProjectData({
    workspace,
    space,
    project: localProject,
    initialTasks,
    initialStatuses,
    initialTags,
    initialView: initialView || undefined,
  });

  const taskOperations = useTaskOperations({
    state,
    updateState,
    supabase,
    refreshTasks,
    refreshStatuses,
    loadAllSubtasks,
    workspace,
    project: localProject,
  });

  const sprintHandlers = useSprintHandlers({
    state,
    updateState,
    supabase,
    refreshTasks,
    refreshSprints,
    workspace,
    project: localProject,
    setShowSprintAssistant,
    setSelectedStoriesForSprint,
    onEditSprintName: (sprint) => setSprintToRename(sprint),
  });

  // Realtime subscriptions
  useRealtimeSubscriptions({
    supabase,
    workspace,
    project: localProject,
    refreshTasks,
    refreshStatuses,
    loadAllSubtasks,
  });

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Memoized computed values
  const getTaskSubtasks = useCallback(
    (taskId: string) => getSubtasksForTask(taskId, state.allSubtasks),
    [state.allSubtasks]
  );

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return filterTasks(state.tasks, state.filters);
  }, [state.tasks, state.filters]);

  // Backlog-only tasks for Turbo Dependencies and Turbo Sprints
  const backlogOnlyTasks = useMemo(() => {
    const backlogStatusIds = new Set<string>();
    for (const status of state.statuses) {
      if (getCanonicalStatusName(status) === "Backlog") {
        backlogStatusIds.add(status.id);
      }
    }
    return filteredTasks.filter((t: any) => backlogStatusIds.has(t.status_id));
  }, [filteredTasks, state.statuses]);

  // To Do tasks for Turbo Prioritize and Turbo Team
  const todoTasks = useMemo(() => {
    const todoStatusIds = new Set<string>();
    for (const status of state.statuses) {
      if (getCanonicalStatusName(status) === "To Do") {
        todoStatusIds.add(status.id);
      }
    }
    return filteredTasks.filter((t: any) => todoStatusIds.has(t.status_id));
  }, [filteredTasks, state.statuses]);

  // Tasks eligible for Turbo Prioritize / Turbo Team — "To Do" OR assigned to any sprint.
  // Count active filters
  const activeFiltersCount = useMemo(() => {
    return (
      state.filters.status.length +
      state.filters.tags.length +
      state.filters.priority.length +
      state.filters.assigned.length +
      (state.filters.sprintPoints.min > 0 ||
      state.filters.sprintPoints.max < 100
        ? 1
        : 0) +
      (state.filters.showUnassignedOnly ? 1 : 0)
    );
  }, [state.filters]);

  // Completed sprints available for archiving
  const completedSprints = useMemo(() => {
    return state.sprints.filter((s: any) => s.status === "completed");
  }, [state.sprints]);

  // Archive sprint handler
  const handleArchiveSprintClick = useCallback((sprint: any) => {
    setArchiveSprintTarget(sprint);
    setArchiveDialogOpen(true);
  }, []);

  const handleArchiveSprintConfirm = useCallback(async (notes?: string) => {
    if (!archiveSprintTarget) return;
    setArchiveLoading(true);
    try {
      const response = await csrfFetch(
        `/api/workspace/${workspace.workspace_id}/sprints/${archiveSprintTarget.id}/archive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to archive sprint");
      }

      const data = await response.json();

      // If the project was closed out, notify sidebar so it removes the project
      if (data.projectClosed && data.projectId) {
        window.dispatchEvent(
          new CustomEvent("projectDeleted", { detail: { projectId: data.projectId } })
        );
        toast({
          title: "Sprint archived",
          description: "Project closed out — no remaining work.",
        });
      } else {
        toast({
          title: "Sprint archived",
          description: `"${archiveSprintTarget.name}" has been moved to the archive.`,
        });
      }

      setArchiveDialogOpen(false);
      setArchiveSprintTarget(null);
      await refreshSprints();
      await refreshTasks();
    } catch (error: any) {
      console.error("Error archiving sprint:", error);
      toast({
        title: "Error archiving sprint",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setArchiveLoading(false);
    }
  }, [archiveSprintTarget, workspace.workspace_id, toast, refreshSprints, refreshTasks]);

  // Listen for sprint data refresh events
  React.useEffect(() => {
    const handleProjectDataRefresh = () => {
      refreshTasks();
      refreshStatuses();
      refreshSprints();
      loadAllSubtasks();
    };

    window.addEventListener("projectDataRefresh", handleProjectDataRefresh);
    return () => {
      window.removeEventListener(
        "projectDataRefresh",
        handleProjectDataRefresh
      );
    };
  }, [refreshTasks, refreshStatuses, refreshSprints, loadAllSubtasks]);

  const handleTaskClick = useCallback(
    (task: any) => {
      // Null safety: validate task object
      if (!task) {
        console.error("handleTaskClick - task is null or undefined");
        toast({
          title: "Error",
          description: "Unable to open task: Invalid task data",
          variant: "destructive",
        });
        return;
      }

      // Debug: log task object to see what fields are available

      // Use task_id if available, otherwise fall back to id (UUID)
      const taskIdentifier = task.task_id || task.id;

      if (!taskIdentifier) {
        console.error("Task has no identifier:", task);
        toast({
          title: "Error",
          description: "Unable to open task: Task identifier not found",
          variant: "destructive",
        });
        return;
      }

      // Null safety: validate workspace_id
      if (!workspace?.workspace_id) {
        console.error("handleTaskClick - workspace_id is missing");
        toast({
          title: "Error",
          description: "Unable to open task: Workspace not found",
          variant: "destructive",
        });
        return;
      }

      router.push(`/${workspace.workspace_id}/task/${taskIdentifier}`);
    },
    [router, workspace?.workspace_id, toast]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const draggedTask = filteredTasks.find((t) => t.id === active.id);
      const draggedStatus = state.statuses.find((s) => s.id === active.id);

      if (draggedTask) {
        updateState({ activeTask: draggedTask, activeStatus: null });
      } else if (draggedStatus) {
        updateState({ activeStatus: draggedStatus, activeTask: null });
      } else {
      }
    },
    [filteredTasks, state.statuses, updateState]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (over) {
        await taskOperations.handleDragEnd(active, over);
      }

      updateState({ activeTask: null, activeStatus: null });
    },
    [taskOperations, updateState, state.activeStatus, state.activeTask]
  );

  const toggleTaskExpansion = useCallback(
    (taskId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newExpandedTasks = new Set(state.expandedTasks);
      if (newExpandedTasks.has(taskId)) {
        newExpandedTasks.delete(taskId);
      } else {
        newExpandedTasks.add(taskId);
      }
      updateState({ expandedTasks: newExpandedTasks });
    },
    [state.expandedTasks, updateState]
  );

  const handleCreateSubtask = useCallback(
    (parentId: string) => {
      updateState({
        subtaskParentId: parentId,
        createTaskModalOpen: true,
      });
    },
    [updateState]
  );

  const handleDeleteTask = useCallback(
    (task: any) => {
      updateState({ taskToDelete: task });
    },
    [updateState]
  );

  const handleOpenStatusSettings = useCallback(
    (status: any) => {
      updateState({ statusSettingsModalOpen: true, statusToEdit: status });
    },
    [updateState]
  );

  const handleRenameProject = useCallback(
    async (projectId: string, newName: string) => {
      if (!newName.trim()) return;

      try {
        const { error } = await supabase
          .from("projects")
          .update({ name: newName.trim() })
          .eq("project_id", project.project_id);

        if (error) throw error;

        // Update local project state immediately for better UX
        setLocalProject((prev) => ({
          ...prev,
          name: newName.trim(),
        }));

        // Emit event to update secondary sidebar
        window.dispatchEvent(
          new CustomEvent("projectRenamed", {
            detail: { project, newName: newName.trim() },
          })
        );

        toast({
          title: "Project renamed",
          description: `Project renamed to "${newName.trim()}".`,
        });

        setRenameProjectId(null);
        setRenameValue("");
      } catch (error: any) {
        console.error("Error renaming project:", error);
        toast({
          title: "Error renaming project",
          description: error.message || "Something went wrong",
          variant: "destructive",
        });
      }
    },
    [supabase, toast, project.project_id, project]
  );

  const handleCopyProjectLink = useCallback(
    async (project: any, space: any) => {
      try {
        const url = `${window.location.origin}/${workspace.workspace_id}/space/${space.space_id}/project/${project.project_id}`;
        await navigator.clipboard.writeText(url);

        toast({
          title: "Link copied",
          description: "Project link copied to clipboard.",
        });
      } catch (error) {
        console.error("Error copying link:", error);
        toast({
          title: "Error copying link",
          description: "Failed to copy link to clipboard.",
          variant: "destructive",
        });
      }
    },
    [workspace.workspace_id, toast]
  );

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      setIsDeletingProject(true);
      try {
        // 1. Delete all tasks for this project
        const timeStamp = new Date().toISOString();
        const { error: tasksError } = await supabase
          .from("tasks")
          .update({ deleted_at: timeStamp })
          .eq("project_id", project.id);
        if (tasksError) {
          console.error("Error deleting project tasks:", tasksError);
          throw tasksError;
        }
        // 2. Delete all statuses for this project
        const { error: statusesError } = await supabase
          .from("statuses")
          .update({ deleted_at: timeStamp })
          .eq("project_id", project.id);
        if (statusesError) {
          console.error("Error deleting project statuses:", statusesError);
          throw statusesError;
        }
        // 3. Delete the project itself
        const { error: deleteError } = await supabase
          .from("projects")
          .update({ deleted_at: timeStamp })
          .eq("id", project.id);
        if (deleteError) {
          console.error("Error deleting project:", deleteError);
          throw deleteError;
        }

        // Remove from favorites if it was favorited
        setProjectFavorites((prev) => {
          const newFavorites = new Set(prev);
          newFavorites.delete(projectId);
          localStorage.setItem(
            `project_favorites_${workspace.id}`,
            JSON.stringify([...newFavorites])
          );
          return newFavorites;
        });

        // Emit event to update secondary sidebar
        window.dispatchEvent(
          new CustomEvent("projectDeleted", {
            detail: { project },
          })
        );

        toast({
          title: "Project deleted",
          description: "Project and all its related data have been deleted.",
        });
        setDeleteProjectId(null);
        // Navigate to home
        router.push(`/${workspace.workspace_id}/home`);
      } catch (error: any) {
        toast({
          title: "Error deleting project",
          description: error.message || "Something went wrong",
          variant: "destructive",
        });
      } finally {
        setIsDeletingProject(false);
      }
    },
    [supabase, toast, router, workspace.workspace_id, project.id, project]
  );

  // Convert project tasks to UserStory format for Sprint Assistant
  const convertTasksToUserStories = useCallback((tasks: any[]): UserStory[] => {
    // First pass: convert priorities and collect parent-child relationships
    const parentChildMap = new Map<string, string[]>();
    const taskPriorityMap = new Map<string, string>();

    tasks.forEach((task) => {
      // Convert priority to proper capitalized format
      if (task.priority) {
        taskPriorityMap.set(
          task.id,
          (task.priority.charAt(0).toUpperCase() +
            task.priority.slice(1).toLowerCase()) as
            | "Low"
            | "Medium"
            | "High"
            | "Critical"
        );
      }

      // Build parent-child relationship map
      if (task.parent_task_id) {
        if (!parentChildMap.has(task.parent_task_id)) {
          parentChildMap.set(task.parent_task_id, []);
        }
        parentChildMap.get(task.parent_task_id)!.push(task.id);
      }
    });

    return tasks.map((task) => ({
      id: task.id,
      title: task.name,
      role: "User", // Default role since tasks don't have this field
      want: task.description || task.name,
      benefit: "Complete the task successfully",
      acceptanceCriteria: task.description ? [task.description] : [task.name],
      storyPoints: task.story_points || 1,
      businessValue: task.business_value || 3,
      userImpact: task.user_impact || 3,
      complexity: task.complexity || 3,
      risk: task.risk || 2,
      dependencies: task.dependencies ? [task.dependencies.toString()] : [],
      priority:
        (taskPriorityMap.get(task.id) as
          | "Low"
          | "Medium"
          | "High"
          | "Critical") || "Medium",
      description: task.description || "",
      tags: task.task_tags?.map((tt: any) => tt.tag.name) || [],
      parentTaskId: task.parent_task_id || undefined,
      childTaskIds: parentChildMap.get(task.id) || [], // Get child task IDs from the map
      suggestedDependencies: [],
      requirements: task.description ? [task.description] : [],
      estimatedTime: task.estimated_time || undefined,
      assignedTeamMember: undefined,
      antiPatternWarnings: task.anti_pattern_warnings || [],
      successPattern: task.success_pattern || "",
      completionRate: task.completion_rate || 0,
      velocity: task.velocity || 0,
      priorityScore: 0,
      dependencyScore: 0,
      estimatedHours: task.estimated_time || 0,
      calculatedAt: new Date().toISOString(),
      sprintId: task.sprint_id || undefined,
      goal: "",
    }));
  }, []);

  // Track if we've already fetched folders for this modal session
  const hasFetchedFoldersRef = useRef(false);

  const fetchSprintFolders = useCallback(async () => {
    // Prevent duplicate fetches
    if (isLoadingSprintFolders) return;

    setIsLoadingSprintFolders(true);
    try {
      const { data, error } = await supabase
        .from("sprint_folders")
        .select("*")
        .eq("space_id", space.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching sprint folders:", error);
        toast({
          title: "Failed to load folders",
          description: "Could not load sprint folders for this space.",
          variant: "destructive",
        });
        return;
      }

      const folders = data || [];
      setSprintFolders(folders);

      if (folders.length > 0) {
        setSelectedSprintFolderId((prev) =>
          prev && prev !== "new" ? prev : folders[0].id
        );
        setSprintFolderName((prev) => prev || folders[0].name);
      } else {
        setSelectedSprintFolderId("new");
        setSprintFolderName(
          (prev) => prev || `Sprint Plan - ${new Date().toLocaleDateString()}`
        );
      }
    } catch (error) {
      console.error("Unexpected error fetching sprint folders:", error);
      toast({
        title: "Failed to load folders",
        description: "An unexpected error occurred while loading folders.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSprintFolders(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space.id, supabase]);

  useEffect(() => {
    if (showSaveSprintsModal && !hasFetchedFoldersRef.current) {
      hasFetchedFoldersRef.current = true;
      fetchSprintFolders();
    }
    // Reset the ref when modal closes
    if (!showSaveSprintsModal) {
      hasFetchedFoldersRef.current = false;
    }
  }, [showSaveSprintsModal, fetchSprintFolders]);

  // Handler for SprintAssistant's Save Sprints button
  const handleSaveSprintsFromAssistant = useCallback(
    (sprints: any[], type: "ai" | "manual") => {
      setSprintsToSave(sprints);
      setSprintType(type);
      setSprintFolderName((prev) =>
        prev || `Sprint Plan - ${new Date().toLocaleDateString()}`
      );
      setSelectedSprintFolderId((prev) => prev || "new");
      setShowSaveSprintsModal(true);
    },
    []
  );

  const handleSaveSprintsToDatabase = useCallback(
    async (
      sprints: any[],
      type: "ai" | "manual",
      folderName: string,
      folderId?: string
    ) => {
      try {
        // Validate input data
        if (!sprints || !Array.isArray(sprints) || sprints.length === 0) {
          toast({
            title: "Invalid sprint data",
            description: "No sprints provided to save.",
            variant: "destructive",
          });
          return;
        }

        // Determine folder to use (existing vs new)
        let sprintFolderId = folderId && folderId !== "new" ? folderId : null;

        if (!sprintFolderId) {
          const finalFolderName =
            folderName || `Sprint Plan - ${new Date().toLocaleDateString()}`;

          if (!finalFolderName.trim()) {
            toast({
              title: "Folder name required",
              description: "Enter a folder name or pick an existing one.",
              variant: "destructive",
            });
            return;
          }

          const {
            success: folderSuccess,
            sprintFolder,
            error: folderError,
          } = await createSprintFolder({
            name: finalFolderName,
            spaceId: space.id,
            projectId: project.id,
            durationWeeks: 2, // Default 2-week sprints
          });

          if (!folderSuccess || !sprintFolder) {
            toast({
              title: "Failed to create sprint folder",
              description:
                folderError ||
                "An error occurred while creating the sprint folder.",
              variant: "destructive",
            });
            return;
          }

          sprintFolderId = sprintFolder.id;
        }

        if (!sprintFolderId) {
          toast({
            title: "No sprint folder selected",
            description: "Choose an existing folder or create a new one to continue.",
            variant: "destructive",
          });
          return;
        }

        // Convert sprints to the format expected by createSprints
        const sprintData = sprints.map((sprint: any) => ({
          name: sprint.name,
          goal: sprint.goal || sprint.description || "",
          startDate: sprint.startDate || sprint.start_date,
          endDate: sprint.endDate || sprint.end_date,
          duration: sprint.duration || 2,
        }));

        // Create the sprints in the folder
        const {
          success: sprintsSuccess,
          createdSprints,
          error: sprintsError,
        } = await createSprints({
          sprints: sprintData,
          sprintFolderId: sprintFolderId!,
          spaceId: space.id,
          workspaceId: workspace.id,
          projectId: project.id,
        });

        if (!sprintsSuccess || !createdSprints) {
          toast({
            title: "Failed to create sprints",
            description:
              sprintsError || "An error occurred while creating the sprints.",
            variant: "destructive",
          });
          return;
        }

        // Move tasks from project to their assigned sprints
        let movedTasksCount = 0;
        let totalTasksToMove = 0;

        // Count total tasks to be moved
        // Support both "stories" (AI flow) and "selectedStories" (manual sprint assistant)
        for (const sprint of sprints) {
          const sprintStories = sprint.stories || sprint.selectedStories;
          if (sprintStories && Array.isArray(sprintStories)) {
            totalTasksToMove += sprintStories.length;
          }
        }

        // Find the "To Do" status for sprint task assignment
        // Tasks move from Backlog → To Do when assigned to a sprint
        const todoStatus = state.statuses.find(
          (s: any) => getCanonicalStatusName(s) === "To Do"
        );
        const sprintStatus = todoStatus ? { id: todoStatus.id } : null;

        if (!sprintStatus) {
          toast({
            title: "No 'To Do' status found",
            description: "Tasks will keep their current status. Add a 'To Do' status in Status Settings to auto-update tasks when assigning to sprints.",
          });
        }

        let failedTasksCount = 0;

        for (const sprint of sprints) {
          const createdSprint = createdSprints.find(
            (cs: any) => cs.name === sprint.name
          );

          if (!createdSprint) {
            continue;
          }

          // Check if sprint has stories (tasks) assigned
          // Support both "stories" (AI flow) and "selectedStories" (manual sprint assistant)
          const sprintStories = sprint.stories || sprint.selectedStories;
          if (
            !sprintStories ||
            !Array.isArray(sprintStories) ||
            sprintStories.length === 0
          ) {
            continue;
          }

          // Get the task IDs that belong to this sprint
          const taskIds = sprintStories
            .map((story: any) => story.id)
            .filter(Boolean);

          if (taskIds.length === 0) {
            continue;
          }

          try {
            // Update tasks to assign them to the sprint while keeping project association
            // Tasks can belong to both a project AND a sprint simultaneously
            // Also update status to "To Do" if available (tasks move from Backlog → To Do)
            const updateData: Record<string, any> = {
              sprint_id: createdSprint.id,
              // Keep project_id - tasks remain associated with their project
              updated_at: new Date().toISOString(),
            };

            // Auto-update status to "To Do" when assigning to sprint
            if (sprintStatus?.id) {
              updateData.status_id = sprintStatus.id;
            }

            const { data: moveData, error: moveError } = await supabase
              .from("tasks")
              .update(updateData)
              .in("id", taskIds)
              .eq("project_id", project.id) // Only move tasks that are currently in this project
              .select("id");

            if (moveError) {
              console.error(
                `Error moving tasks to sprint ${createdSprint.name}:`,
                moveError
              );
              failedTasksCount += taskIds.length;
            } else {
              const actualMoved = moveData?.length || 0;
              movedTasksCount += actualMoved;
              const unmoved = taskIds.length - actualMoved;
              if (unmoved > 0) {
                console.warn(
                  `Sprint "${createdSprint.name}": Only ${actualMoved}/${taskIds.length} tasks were assigned. ` +
                  `Expected IDs: ${taskIds.join(", ")}. This may indicate an RLS policy or project_id mismatch.`
                );
                failedTasksCount += unmoved;
              }
            }
          } catch (error) {
            console.error(
              `Error moving tasks to sprint ${createdSprint.name}:`,
              error
            );
            failedTasksCount += taskIds.length;
          }
        }

        // Show a single combined toast based on results
        const method = type === "ai" ? "AI" : "manual";
        if (failedTasksCount === 0 && movedTasksCount > 0) {
          // All succeeded
          toast({
            title: "Sprints planned successfully",
            description: `${sprints.length} sprints created with ${method} analysis. ${movedTasksCount} tasks assigned.`,
          });
        } else if (movedTasksCount > 0 && failedTasksCount > 0) {
          // Partial success
          toast({
            title: "Sprints created with some issues",
            description: `${movedTasksCount} of ${movedTasksCount + failedTasksCount} tasks assigned. ${failedTasksCount} tasks could not be assigned — try refreshing or reassigning manually.`,
            variant: "destructive",
          });
        } else if (movedTasksCount === 0 && totalTasksToMove > 0) {
          // All failed
          toast({
            title: "Sprints created but tasks not assigned",
            description: `${sprints.length} sprints were created, but no tasks could be assigned. Try refreshing the page and reassigning manually.`,
            variant: "destructive",
          });
        } else {
          // No tasks to move (sprints only)
          toast({
            title: "Sprints planned successfully",
            description: `${sprints.length} sprints created with ${method} analysis.`,
          });
        }

        // Close both modals
        setShowSaveSprintsModal(false);
        setShowSprintAssistant(false);

        // Refresh data to show newly created sprints
        await refreshSprints();
        await refreshTasks();

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("projectDataRefresh"));
          window.dispatchEvent(new CustomEvent("refreshSidebar"));
        }

        // Auto-navigate to the first created sprint so user can Prioritize / Assign Team
        if (createdSprints && createdSprints.length > 0) {
          const firstSprint = createdSprints[0];
          // Look up the sprint folder's friendly ID for the URL
          const { data: folder } = await supabase
            .from("sprint_folders")
            .select("sprint_folder_id")
            .eq("id", sprintFolderId)
            .single();

          if (folder?.sprint_folder_id && firstSprint.sprint_id) {
            router.push(
              `/${workspace.workspace_id}/space/${space.space_id}/sf/${folder.sprint_folder_id}/s/${firstSprint.sprint_id}`
            );
          } else {
            // Fallback: stay on project view, switch to Sprints tab
            updateState({ view: "sprints" as ViewMode });
          }
        } else {
          updateState({ view: "sprints" as ViewMode });
        }

      } catch (error) {
        console.error("Error saving sprints:", error);
        toast({
          title: "Failed to save sprints",
          description: "An unexpected error occurred while saving the sprints.",
          variant: "destructive",
        });
      }
    },
    [
      toast,
      space.id,
      workspace.id,
      setShowSaveSprintsModal,
      setShowSprintAssistant,
      supabase,
      project.id,
      refreshSprints,
      refreshTasks,
      updateState,
      state.expandedSprints,
    ]
  );

  const renderCurrentView = () => {
    const commonProps = {
      state,
      updateState,
      taskOperations,
      getTaskSubtasks,
      handleTaskClick,
      toggleTaskExpansion,
      handleCreateSubtask,
      handleDeleteTask,
      tasks: filteredTasks,
      onOpenStatusSettings: handleOpenStatusSettings,
      onDeleteStatus: taskOperations.handleDeleteStatus,
      onDeleteStatusWithReassignment: taskOperations.handleDeleteStatusWithReassignment,
      onReorderStatus: taskOperations.handleReorderStatus,
    };

    switch (state.view) {
      case "board":
        return (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <BoardView {...commonProps} />
            <DragOverlay>
              {state.activeTask ? (
                <TaskCard
                  task={state.activeTask}
                  isDragging
                  subtasks={getTaskSubtasks(state.activeTask.id)}
                  isExpanded={state.expandedTasks.has(state.activeTask.id)}
                  workspaceMembers={state.workspaceMembers}
                  onToggleExpansion={toggleTaskExpansion}
                  onTaskClick={handleTaskClick}
                  onRenameTask={taskOperations.handleRenameTask}
                  onUpdatePriority={taskOperations.handleUpdatePriority}
                  onUpdateDates={taskOperations.handleUpdateDates}
                  onAssignTask={taskOperations.handleAssignTask}
                  onDeleteTask={handleDeleteTask}
                  onCreateSubtask={handleCreateSubtask}
                  teamMembers={state.teamMembers}
                />
              ) : state.activeStatus ? (
                <div className="transform rotate-2 shadow-2xl">
                  <StatusColumn
                    status={state.activeStatus}
                    tasks={filteredTasks.filter(
                      (t) =>
                        t.status_id === state.activeStatus!.id &&
                        !t.parent_task_id
                    )}
                    onCreateTask={() =>
                      updateState({ createTaskModalOpen: true })
                    }
                    onRenameStatus={taskOperations.handleRenameStatus}
                    onDeleteStatus={taskOperations.handleDeleteStatus}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        );
      case "list":
        return <ListView {...commonProps} />;
      case "sprints":
        return (
          <SprintsView
            tasks={filteredTasks}
            sprints={state.sprints || []}
            statuses={state.statuses}
            expandedSprints={state.expandedSprints || new Set()}
            onToggleSprintExpand={sprintHandlers.handleToggleSprintExpand}
            onCreateSprint={sprintHandlers.handleCreateSprint}
            onEditSprint={sprintHandlers.handleEditSprint}
            onDeleteSprint={sprintHandlers.handleDeleteSprint}
            onTaskClick={handleTaskClick}
            onMoveTaskToSprint={sprintHandlers.handleMoveTaskToSprint}
            onStartSprint={sprintHandlers.handleStartSprint}
            onCompleteSprint={sprintHandlers.handleCompleteSprint}
          />
        );
      case "backlog":
        return (
          <BacklogView
            tasks={filteredTasks}
            sprints={state.sprints || []}
            statuses={state.statuses}
            workspaceMembers={state.workspaceMembers}
            teamMembers={state.teamMembers}
            onCreateTask={() => updateState({ createTaskModalOpen: true })}
            onTaskClick={handleTaskClick}
            onDeleteTask={handleDeleteTask}
            onMoveTaskToSprint={sprintHandlers.handleMoveTaskToSprint}
            onReorderTasks={sprintHandlers.handleReorderBacklogTasks}
            onUpdatePriority={taskOperations.handleUpdatePriority}
            onCreateSprintFromStories={sprintHandlers.handleCreateSprintFromStories}
            onBulkMove={(ids) => {
              setBulkMoveTaskIds(ids);
              setIsBulkMoveOpen(true);
            }}
          />
        );
      default:
        return <BoardView {...commonProps} />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="workspace-header-bg border-b workspace-border">
        {/* Top section */}
        <ProjectHeader
          localProjectName={localProject.name}
          space={space}
          onRename={() => {
            setRenameProjectId(project.id);
            setRenameValue(localProject.name);
          }}
          onCopyLink={() => handleCopyProjectLink(project, space)}
          onCopyProjectId={async () => {
            try {
              await navigator.clipboard.writeText(project.project_id);
              toast({
                title: "Project ID copied",
                description: "Project ID has been copied to clipboard",
              });
            } catch (error) {
              console.error("Failed to copy project ID:", error);
              toast({
                title: "Failed to copy",
                description: "Could not copy project ID to clipboard",
                variant: "destructive",
              });
            }
          }}
          onDelete={() => setDeleteProjectId(project.id)}
          onCreateTask={() => updateState({ createTaskModalOpen: true })}
          onCreateStatus={() => updateState({ createStatusModalOpen: true })}
        />

        {/* Bottom section - View switcher and controls */}
        <div className="px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* View switcher */}
              <div id="project-view-switcher" className="flex items-center space-x-1 bg-muted rounded-lg p-1">
                {state.activeViews.map((viewType) => (
                  <Button
                    key={viewType}
                    variant={state.view === viewType ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => updateState({ view: viewType })}
                    className={`text-xs h-7 sm:px-3 px-2 ${
                      state.view === viewType
                        ? "workspace-component-bg workspace-component-active-color hover:workspace-component-bg"
                        : "hover:workspace-component-bg"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {viewType === "board" && (
                        <LayoutGrid className="h-4 w-4" />
                      )}
                      {viewType === "list" && <List className="h-4 w-4" />}
                      {viewType === "sprints" && <Zap className="h-4 w-4" />}
                      {viewType === "backlog" && <Archive className="h-4 w-4" />}
                      <span className="hidden sm:inline">
                        {viewType === "backlog" ? "Turbo Tasks" : viewType.charAt(0).toUpperCase() + viewType.slice(1)}
                      </span>
                    </div>
                  </Button>
                ))}

                {/* Turbo Sprints - visible on Turbo Tasks (backlog) tab when backlog has tasks */}
                {state.view === "backlog" && backlogOnlyTasks.length > 0 && (
                <div id="project-ai-tools" className="hidden sm:flex items-center border-l border-gray-300 dark:border-gray-600 ml-1 pl-1">
                  <Button
                    id="project-turbo-optimize"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSprintAssistant(true)}
                    className="text-xs h-7 px-2 hover:workspace-component-bg"
                  >
                    <ChartGantt className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="hidden lg:inline ml-1">Turbo Sprints</span>
                  </Button>
                </div>
                )}

                  <div className="hidden sm:flex items-center border-l border-gray-300 dark:border-gray-600 ml-1 pl-1">
                  {/* Archive Sprint Button */}
                  {completedSprints.length === 1 ? (
                    <Button
                      id="project-archive-sprint"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleArchiveSprintClick(completedSprints[0])}
                      className="text-xs h-7 px-2 hover:workspace-component-bg"
                      title={`Archive "${completedSprints[0].name}"`}
                    >
                      <Archive className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                      <span className="hidden lg:inline ml-1">Archive</span>
                    </Button>
                  ) : completedSprints.length > 1 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          id="project-archive-sprint"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-2 hover:workspace-component-bg"
                          title="Archive a completed sprint"
                        >
                          <Archive className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                          <span className="hidden lg:inline ml-1">Archive</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[220px]">
                        {completedSprints.map((sprint: any) => (
                          <DropdownMenuItem
                            key={sprint.id}
                            className="text-xs hover:workspace-hover cursor-pointer"
                            onClick={() => handleArchiveSprintClick(sprint)}
                          >
                            <Archive className="h-4 w-4 mr-2 text-orange-500" />
                            {sprint.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Button
                      id="project-archive-sprint"
                      variant="ghost"
                      size="sm"
                      disabled
                      className="text-xs h-7 px-2 hover:workspace-component-bg"
                      title="No completed sprints to archive"
                    >
                      <Archive className="h-4 w-4 text-orange-500/50 dark:text-orange-400/50" />
                      <span className="hidden lg:inline ml-1">Archive</span>
                    </Button>
                  )}

                </div>

                {/* Mobile: AI Tools dropdown */}
                <div className="sm:hidden border-l border-gray-300 dark:border-gray-600 ml-1 pl-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        disabled={!filteredTasks.length}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[180px]">
                      {state.view === "backlog" && backlogOnlyTasks.length > 0 && (
                        <>
                          <DropdownMenuItem
                            className="text-xs hover:workspace-hover cursor-pointer"
                            onClick={() => setShowSprintAssistant(true)}
                          >
                            <ChartGantt className="h-4 w-4 mr-2 text-emerald-600 dark:text-emerald-400" />
                            Turbo Sprints
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      {completedSprints.length > 0 && (
                        <>
                          {completedSprints.map((sprint: any) => (
                            <DropdownMenuItem
                              key={sprint.id}
                              className="text-xs hover:workspace-hover cursor-pointer"
                              onClick={() => handleArchiveSprintClick(sprint)}
                            >
                              <Archive className="h-4 w-4 mr-2 text-orange-500" />
                              Archive: {sprint.name}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="flex items-center space-x-1 sm:space-x-2">
                {state.view === "list" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateState({ customizeListModalOpen: true })
                    }
                    className="text-muted-foreground text-xs h-7 sm:px-2 px-1.5"
                  >
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Columns</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateState({ filterModalOpen: true })}
                  className="text-muted-foreground text-xs h-7 sm:px-2 px-1.5 relative"
                >
                  <Filter className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Filter</span>
                  {activeFiltersCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center"
                    >
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      updateState({
                        filters: {
                          status: [],
                          tags: [],
                          priority: [],
                          assigned: [],
                          sprintPoints: { min: 0, max: 100 },
                          showUnassignedOnly: false,
                        },
                      })
                    }
                    className="text-muted-foreground text-xs h-7 sm:px-2 px-1.5"
                  >
                    <span className="hidden sm:inline">Clear</span>
                    <span className="sm:hidden">×</span>
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground text-xs h-7 sm:px-2 px-1.5 relative"
                    >
                      <Users className="h-4 w-4" />
                      <span className="hidden sm:inline ml-1">Assignee</span>
                      {(state.filters.assigned.length > 0 ||
                        state.filters.showUnassignedOnly) && (
                        <Badge
                          variant="secondary"
                          className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center"
                        >
                          {state.filters.showUnassignedOnly
                            ? 1
                            : state.filters.assigned.length}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-[200px] max-h-[200px] overflow-y-auto"
                  >
                    <DropdownMenuItem
                      onClick={() =>
                        updateState({
                          filters: {
                            ...state.filters,
                            assigned: [],
                            showUnassignedOnly: false,
                          },
                        })
                      }
                      className="text-xs"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      All assignees
                      {state.filters.assigned.length === 0 &&
                        !state.filters.showUnassignedOnly && (
                          <CheckIcon className="ml-auto h-4 w-4" />
                        )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        updateState({
                          filters: {
                            ...state.filters,
                            assigned: [
                              ...state.workspaceMembers.map((m) => m.id),
                              ...state.teamMembers.map((m) => `team-${m.id}`),
                            ],
                            showUnassignedOnly: false,
                          },
                        })
                      }
                      className="text-xs"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Assigned tasks
                      {state.filters.assigned.length ===
                        state.workspaceMembers.length +
                          state.teamMembers.length &&
                        !state.filters.showUnassignedOnly && (
                          <CheckIcon className="ml-auto h-4 w-4" />
                        )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        updateState({
                          filters: {
                            ...state.filters,
                            assigned: [],
                            showUnassignedOnly: true,
                          },
                        })
                      }
                      className="text-xs"
                    >
                      <CircleUserRound className="h-4 w-4 mr-2" />
                      Unassigned
                      {state.filters.showUnassignedOnly && (
                        <CheckIcon className="ml-auto h-4 w-4" />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />

                    {/* Workspace Members */}
                    {state.workspaceMembers.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                          Workspace Members
                        </div>
                        {state.workspaceMembers.map((member) => (
                          <DropdownMenuItem
                            key={member.id}
                            onClick={() => {
                              const isSelected =
                                state.filters.assigned.includes(member.id);
                              updateState({
                                filters: {
                                  ...state.filters,
                                  assigned: isSelected
                                    ? state.filters.assigned.filter(
                                        (id) => id !== member.id
                                      )
                                    : [...state.filters.assigned, member.id],
                                  showUnassignedOnly: false,
                                },
                              });
                            }}
                            className="text-xs flex items-center justify-between"
                          >
                            <div className="flex items-center">
                              <Avatar className="h-4 w-4 mr-2">
                                <AvatarImage
                                  src={member.avatar_url ?? undefined}
                                  alt={member.full_name || "User"}
                                />
                                <AvatarFallback className="text-[8px]">
                                  {getAvatarInitials(
                                    member.full_name,
                                    member.email
                                  )}
                                </AvatarFallback>
                              </Avatar>
                              <span>{member.full_name}</span>
                            </div>
                            {state.filters.assigned.includes(member.id) && (
                              <CheckIcon className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}

                    {/* Team Members */}
                    {state.teamMembers.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                          Team Members
                        </div>
                        {state.teamMembers.map((member) => (
                          <DropdownMenuItem
                            key={`team-${member.id}`}
                            onClick={() => {
                              const teamMemberId = `team-${member.id}`;
                              const isSelected =
                                state.filters.assigned.includes(teamMemberId);
                              updateState({
                                filters: {
                                  ...state.filters,
                                  assigned: isSelected
                                    ? state.filters.assigned.filter(
                                        (id) => id !== teamMemberId
                                      )
                                    : [...state.filters.assigned, teamMemberId],
                                  showUnassignedOnly: false,
                                },
                              });
                            }}
                            className="text-xs flex items-center justify-between"
                          >
                            <div className="flex items-center">
                              <Avatar className="h-4 w-4 mr-2">
                                <AvatarImage
                                  src={member.profile?.avatar_url ?? undefined}
                                  alt={
                                    member.profile?.full_name ||
                                    member.name ||
                                    "User"
                                  }
                                />
                                <AvatarFallback className="text-[8px]">
                                  {getAvatarInitials(
                                    member.profile?.full_name || member.name,
                                    member.profile?.email || member.email
                                  )}
                                </AvatarFallback>
                              </Avatar>
                              <span>
                                {member.profile?.full_name || member.name}
                              </span>
                            </div>
                            {state.filters.assigned.includes(
                              `team-${member.id}`
                            ) && <CheckIcon className="h-4 w-4" />}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      {renderCurrentView()}

      {/* Modals */}
      <CreateTaskModal
        open={state.createTaskModalOpen}
        onOpenChange={(open) => {
          updateState({
            createTaskModalOpen: open,
            subtaskParentId: open ? state.subtaskParentId : undefined,
          });
        }}
        onSuccess={taskOperations.handleTaskCreated}
        workspace={workspace}
        space={space}
        project={localProject || project}
        statuses={state.statuses}
        tags={state.tags}
        parentTaskId={state.subtaskParentId}
      />

      <CreateStatusModal
        open={state.createStatusModalOpen}
        onOpenChange={(open) => updateState({ createStatusModalOpen: open })}
        onSuccess={taskOperations.handleStatusCreated}
        workspace={workspace}
        space={space}
        project={localProject}
        statusTypes={state.statusTypes}
      />

      <StatusSettingsModal
        open={state.statusSettingsModalOpen}
        onOpenChange={(open) => updateState({ statusSettingsModalOpen: open })}
        status={state.statusToEdit}
        onSave={taskOperations.handleUpdateStatusSettings}
        statusTypes={state.statusTypes}
        workspace={workspace}
        space={space}
        project={localProject}
      />

      <FilterModal
        open={state.filterModalOpen}
        onOpenChange={(open) => updateState({ filterModalOpen: open })}
        filters={state.filters}
        onFiltersChange={(filters) => updateState({ filters })}
        statuses={state.statuses}
        tags={state.tags}
        workspaceMembers={state.workspaceMembers as any}
        teamMembers={state.teamMembers}
      />

      {state.view === "list" && (
        <CustomizeListModal
          open={state.customizeListModalOpen}
          onOpenChange={(open) => updateState({ customizeListModalOpen: open })}
          currentVisibleColumns={state.visibleColumns}
          onSave={(columns) => updateState({ visibleColumns: columns })}
        />
      )}

      {/* Rename Sprint Modal */}
      {sprintToRename && (
        <RenameSprintModal
          open={!!sprintToRename}
          onOpenChange={(open) => {
            if (!open) setSprintToRename(null);
          }}
          onSuccess={async () => {
            await refreshSprints();
            setSprintToRename(null);
          }}
          sprint={sprintToRename}
        />
      )}

      {/* Archive Sprint Confirmation Dialog */}
      <ArchiveConfirmationDialog
        isOpen={archiveDialogOpen}
        onClose={() => {
          setArchiveDialogOpen(false);
          setArchiveSprintTarget(null);
        }}
        onConfirm={handleArchiveSprintConfirm}
        sprintName={archiveSprintTarget?.name || ""}
        taskCount={state.tasks.filter((t: any) => t.sprint_id === archiveSprintTarget?.id).length}
        isLoading={archiveLoading}
      />

      {/* Project Modals (Delete Task, Rename Project, Delete Project) */}
      <ProjectModals
        taskToDelete={state.taskToDelete}
        onCloseTaskDelete={() => updateState({ taskToDelete: null })}
        onConfirmTaskDelete={() =>
          state.taskToDelete &&
          taskOperations.handleDeleteTask(state.taskToDelete.id)
        }
        showRenameDialog={!!renameProjectId}
        renameValue={renameValue}
        onRenameValueChange={setRenameValue}
        onCloseRename={() => setRenameProjectId(null)}
        onConfirmRename={() => handleRenameProject(renameProjectId!, renameValue)}
        showDeleteDialog={!!deleteProjectId}
        projectName={localProject.name}
        onCloseDelete={() => setDeleteProjectId(null)}
        onConfirmDelete={() => handleDeleteProject(deleteProjectId!)}
        isDeleting={isDeletingProject}
      />

      {/* Bulk Move Task Modal (from BacklogView selection) */}
      <MoveTaskModal
        isOpen={isBulkMoveOpen}
        onClose={() => {
          setIsBulkMoveOpen(false);
          setBulkMoveTaskIds([]);
        }}
        taskIds={bulkMoveTaskIds}
        currentProjectId={localProject.id}
        workspace={workspace}
        onSuccess={() => {
          refreshTasks();
        }}
      />

      {/* Sprint Assistant Modal */}
      <Dialog open={showSprintAssistant} onOpenChange={setShowSprintAssistant}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sprint Planning Assistant</DialogTitle>
          </DialogHeader>
          <SprintAssistant
            stories={convertTasksToUserStories(backlogOnlyTasks.filter(t => !t.sprint_id && !t.parent_task_id))}
            teamMembers={state.teamMembers}
            workspaceId={workspace.id}
            initialSelectedStories={selectedStoriesForSprint.length > 0 ? selectedStoriesForSprint : undefined}
            onSprintCreated={(sprint) => {
              toast({
                title: "Sprint optimized",
                description: `Sprint "${sprint.name}" with ${sprint.stories.length} stories created successfully.`,
              });
            }}
            onClose={() => {
              setShowSprintAssistant(false);
              setSelectedStoriesForSprint([]);
            }}
            onSaveSprints={handleSaveSprintsFromAssistant}
          />
        </DialogContent>
      </Dialog>

      {/* Save Sprints Modal */}
      <Dialog
        open={showSaveSprintsModal}
        onOpenChange={setShowSaveSprintsModal}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChartGantt className="h-5 w-5" />
              Save Sprints
            </DialogTitle>
            <DialogDescription>
              You have {sprintsToSave.length} sprints ready to save to your
              workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {/* Sprint Summary */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Sprint Summary
              </h3>
              <div className="grid gap-3">
                {sprintsToSave.map((sprint, index) => (
                  <div
                    key={index}
                    className="p-3 border rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">
                        Sprint {index + 1}: {sprint.name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {sprint.duration || 2} weeks
                      </Badge>
                    </div>
                    {sprint.goal && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {sprint.goal}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {sprint.startDate && (
                        <span>
                          Start:{" "}
                          {new Date(sprint.startDate).toLocaleDateString()}
                        </span>
                      )}
                      {sprint.endDate && (
                        <span>
                          End: {new Date(sprint.endDate).toLocaleDateString()}
                        </span>
                      )}
                      {sprint.stories && (
                        <span>{sprint.stories.length} stories</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Folder Configuration */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Folder className="h-4 w-4" />
                Folder Configuration
              </h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Sprint Folder</Label>
                  <Select
                    value={selectedSprintFolderId}
                    onValueChange={(value) => {
                      setSelectedSprintFolderId(value);
                      if (value !== "new") {
                        const selected = sprintFolders.find((f) => f.id === value);
                        if (selected) {
                          setSprintFolderName(selected.name);
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a sprint folder" />
                    </SelectTrigger>
                    <SelectContent>
                      {sprintFolders.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {folder.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="new">Create new folder</SelectItem>
                    </SelectContent>
                  </Select>
                  {isLoadingSprintFolders && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading folders...
                    </p>
                  )}
                  {!isLoadingSprintFolders && sprintFolders.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No sprint folders yet. Create a new one to store these sprints.
                    </p>
                  )}
                </div>

                {selectedSprintFolderId === "new" && (
                  <div>
                    <Label
                      htmlFor="sprint-folder-name"
                      className="text-sm font-medium"
                    >
                      New Folder Name
                    </Label>
                    <Input
                      id="sprint-folder-name"
                      value={sprintFolderName}
                      onChange={(e) => setSprintFolderName(e.target.value)}
                      placeholder="Enter a descriptive name for your sprint folder"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This folder will contain all your planned sprints and can be
                      found in the space sprint folders.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveSprintsModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await handleSaveSprintsToDatabase(
                  sprintsToSave,
                  sprintType,
                  sprintFolderName,
                  selectedSprintFolderId
                );
              }}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Sprints
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
