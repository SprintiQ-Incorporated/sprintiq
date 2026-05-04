/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/rules-of-hooks */
"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  GripVertical,
  ChevronRight,
  Archive,
  Zap,
  MoreHorizontal,
  Edit,
  Trash,
  FolderKanban,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

const BULK_MOVE_CAP = 50;
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task, Sprint, Status, Profile } from "@/lib/database-aliases";
import { priorityConfig } from "../types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from "@/lib/utils";

interface BacklogViewProps {
  tasks: Task[];
  sprints: Sprint[];
  statuses: Status[];
  workspaceMembers: Profile[];
  teamMembers: any[];
  onCreateTask: () => void;
  onTaskClick: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onMoveTaskToSprint: (taskId: string, sprintId: string | null) => Promise<void>;
  onReorderTasks: (taskIds: string[]) => Promise<void>;
  onUpdatePriority: (taskId: string, priority: string | null) => void;
  onCreateSprintFromStories?: (taskIds: string[]) => void;
  onBulkMove?: (taskIds: string[]) => void;
}

// Sortable backlog item
function SortableBacklogItem({
  task,
  statuses,
  sprints,
  workspaceMembers,
  teamMembers,
  onTaskClick,
  onDeleteTask,
  onMoveTaskToSprint,
  onUpdatePriority,
  isSelected,
  onToggleSelect,
}: {
  task: Task;
  statuses: Status[];
  sprints: Sprint[];
  workspaceMembers: Profile[];
  teamMembers: any[];
  onTaskClick: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onMoveTaskToSprint: (taskId: string, sprintId: string | null) => Promise<void>;
  onUpdatePriority: (taskId: string, priority: string | null) => void;
  isSelected: boolean;
  onToggleSelect: (taskId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const status = statuses.find((s) => s.id === task.status_id);
  const priority = task.priority as keyof typeof priorityConfig | null;
  const priorityInfo = priority ? priorityConfig[priority] : null;

  // Find assignee
  const assignee = task.assignee_id
    ? workspaceMembers.find((m) => m.id === task.assignee_id) ?? null
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors group ${
        isDragging ? "opacity-50 shadow-lg" : ""
      } ${isSelected ? "ring-2 ring-primary" : ""}`}
    >
      {/* Checkbox */}
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggleSelect(task.id)}
        className="shrink-0"
      />

      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab hover:bg-muted p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Priority Indicator */}
      {priorityInfo && (
        <div className={`w-1 h-8 rounded-full ${priorityInfo.bgColor}`} />
      )}

      {/* Task Content */}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onTaskClick(task)}
      >
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{task.name}</p>
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {task.description}
          </p>
        )}
      </div>

      {/* Status */}
      {status && (
        <Badge variant="secondary" className="text-xs shrink-0">
          {status.name}
        </Badge>
      )}

      {/* Story Points */}
      {task.story_points && (
        <Badge variant="outline" className="text-xs shrink-0">
          {task.story_points} SP
        </Badge>
      )}

      {/* Assignee */}
      {assignee && (
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarImage
            src={(assignee as any).avatar_url || (assignee as any).profile?.avatar_url}
            alt={(assignee as any).full_name || (assignee as any).name}
          />
          <AvatarFallback className="text-xs">
            {getAvatarInitials(
              (assignee as any).full_name || (assignee as any).name,
              (assignee as any).email
            )}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onTaskClick(task)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Task
          </DropdownMenuItem>

          {/* Move to Sprint */}
          {sprints.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Zap className="h-4 w-4 mr-2" />
                Move to Sprint
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {sprints.map((sprint) => (
                  <DropdownMenuItem
                    key={sprint.id}
                    onClick={() => onMoveTaskToSprint(task.id, sprint.id)}
                  >
                    {sprint.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {/* Set Priority */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ChevronRight className="h-4 w-4 mr-2" />
              Set Priority
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {Object.entries(priorityConfig).map(([key, config]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => onUpdatePriority(task.id, key)}
                >
                  <div className={`w-2 h-2 rounded-full ${config.bgColor} mr-2`} />
                  {config.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onUpdatePriority(task.id, null)}>
                No Priority
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => onDeleteTask(task)}
          >
            <Trash className="h-4 w-4 mr-2" />
            Delete Task
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function BacklogView({
  tasks,
  sprints,
  statuses,
  workspaceMembers,
  teamMembers,
  onCreateTask,
  onTaskClick,
  onDeleteTask,
  onMoveTaskToSprint,
  onReorderTasks,
  onUpdatePriority,
  onCreateSprintFromStories,
  onBulkMove,
}: BacklogViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Filter backlog tasks (tasks not assigned to any sprint)
  const backlogTasks = useMemo(() => {
    let filtered = tasks.filter(
      (task) => !task.sprint_id && !task.parent_task_id
    );

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.name.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query)
      );
    }

    // Apply priority filter
    if (priorityFilter) {
      filtered = filtered.filter((task) => task.priority === priorityFilter);
    }

    // Sort by backlog_position or created_at
    return filtered.sort((a, b) => {
      if (a.backlog_position != null && b.backlog_position != null) {
        return a.backlog_position - b.backlog_position;
      }
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });
  }, [tasks, searchQuery, priorityFilter]);

  // Calculate stats
  const totalPoints = backlogTasks.reduce(
    (sum, t) => sum + (t.story_points || 0),
    0
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      const oldIndex = backlogTasks.findIndex((t) => t.id === active.id);
      const newIndex = backlogTasks.findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(backlogTasks, oldIndex, newIndex);
        await onReorderTasks(newOrder.map((t) => t.id));
      }
    },
    [backlogTasks, onReorderTasks]
  );

  const handleToggleSelect = useCallback((taskId: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedTasks.size === backlogTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(backlogTasks.map((t) => t.id)));
    }
  }, [backlogTasks, selectedTasks.size]);

  const handleCreateSprintFromSelected = useCallback(() => {
    if (selectedTasks.size > 0 && onCreateSprintFromStories) {
      onCreateSprintFromStories(Array.from(selectedTasks));
      setSelectedTasks(new Set());
    }
  }, [selectedTasks, onCreateSprintFromStories]);

  const handleBulkMoveSelected = useCallback(() => {
    if (selectedTasks.size === 0 || !onBulkMove) return;
    let ids = Array.from(selectedTasks);
    if (ids.length > BULK_MOVE_CAP) {
      toast({
        title: `Moving the first ${BULK_MOVE_CAP} tasks`,
        description: `You selected ${ids.length}. The API caps each move at ${BULK_MOVE_CAP} — run again for the rest.`,
      });
      ids = ids.slice(0, BULK_MOVE_CAP);
    }
    onBulkMove(ids);
    setSelectedTasks(new Set());
  }, [selectedTasks, onBulkMove]);

  return (
    <div className="flex-1 overflow-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Turbo Tasks
          </h2>
          <p className="text-sm text-muted-foreground">
            {backlogTasks.length} tasks · {totalPoints} story points
            {selectedTasks.size > 0 && ` · ${selectedTasks.size} selected`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedTasks.size > 0 && onBulkMove && (
            <Button onClick={handleBulkMoveSelected} size="sm" variant="outline">
              <FolderKanban className="h-4 w-4 mr-2" />
              Move to…
            </Button>
          )}
          {selectedTasks.size > 0 && onCreateSprintFromStories && (
            <Button onClick={handleCreateSprintFromSelected} size="sm" variant="default">
              <Zap className="h-4 w-4 mr-2" />
              Create Sprint from Selected
            </Button>
          )}
          <Button onClick={onCreateTask} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        {backlogTasks.length > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedTasks.size === backlogTasks.length && backlogTasks.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-muted-foreground">Select All</span>
          </div>
        )}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search turbo tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {priorityFilter
                ? priorityConfig[priorityFilter as keyof typeof priorityConfig]?.label
                : "All Priorities"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setPriorityFilter(null)}>
              All Priorities
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {Object.entries(priorityConfig).map(([key, config]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setPriorityFilter(key)}
              >
                <div className={`w-2 h-2 rounded-full ${config.bgColor} mr-2`} />
                {config.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Backlog List */}
      {backlogTasks.length > 0 ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext
            items={backlogTasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {backlogTasks.map((task) => (
                <SortableBacklogItem
                  key={task.id}
                  task={task}
                  statuses={statuses}
                  sprints={sprints}
                  workspaceMembers={workspaceMembers}
                  teamMembers={teamMembers}
                  onTaskClick={onTaskClick}
                  onDeleteTask={onDeleteTask}
                  onMoveTaskToSprint={onMoveTaskToSprint}
                  onUpdatePriority={onUpdatePriority}
                  isSelected={selectedTasks.has(task.id)}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Archive className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">
            {searchQuery || priorityFilter ? "No matching tasks" : "Turbo Tasks is empty"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            {searchQuery || priorityFilter
              ? "Try adjusting your filters to see more tasks."
              : "Tasks not assigned to sprints will appear here. Add tasks to start building your turbo tasks."}
          </p>
          {!searchQuery && !priorityFilter && (
            <Button onClick={onCreateTask}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Task
            </Button>
          )}
        </div>
      )}

      {/* Quick Stats */}
      {backlogTasks.length > 0 && (
        <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
          <h4 className="text-sm font-medium mb-3">Turbo Tasks Summary</h4>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Tasks</p>
              <p className="text-lg font-semibold">{backlogTasks.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Story Points</p>
              <p className="text-lg font-semibold">{totalPoints}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Critical/High</p>
              <p className="text-lg font-semibold text-red-600">
                {backlogTasks.filter((t) => t.priority === "critical" || t.priority === "high").length}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Unestimated</p>
              <p className="text-lg font-semibold text-amber-600">
                {backlogTasks.filter((t) => !t.story_points).length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
