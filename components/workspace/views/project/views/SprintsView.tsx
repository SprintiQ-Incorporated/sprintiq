"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Zap,
  Play,
  MoreHorizontal,
  Edit,
  Trash,
  GripVertical,
  X,
  Archive,
  AlertCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { format, differenceInDays, isAfter, isBefore, startOfDay } from "date-fns";
import type { Task, Sprint, Status } from "@/lib/database-aliases";
import { getCompletedStatuses } from "@/lib/status-utils";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import { ToastAction } from "@/components/ui/toast";

interface SprintsViewProps {
  tasks: Task[];
  sprints: Sprint[];
  statuses: Status[];
  expandedSprints: Set<string>;
  onToggleSprintExpand: (sprintId: string) => void;
  onCreateSprint: () => void;
  onEditSprint: (sprint: Sprint) => void;
  onDeleteSprint: (sprintId: string) => void;
  onTaskClick: (task: Task) => void;
  onMoveTaskToSprint: (taskId: string, sprintId: string | null) => Promise<void>;
  onStartSprint: (sprintId: string) => void;
  onCompleteSprint: (sprintId: string) => void;
}

// Sprint Story Row with quick actions
function SprintStoryRow({
  task,
  statuses,
  onTaskClick,
  onRemoveFromSprint,
}: {
  task: Task;
  statuses: Status[];
  onTaskClick: (task: Task) => void;
  onRemoveFromSprint: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: { type: "task", task },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const status = statuses.find((s) => s.id === task.status_id);
  const completedStatuses = getCompletedStatuses(statuses);
  const isCompleted = completedStatuses.some((s) => s.id === task.status_id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors group",
        isDragging && "opacity-50 shadow-lg",
        isCompleted && "opacity-60"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab hover:bg-muted p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onTaskClick(task)}
      >
        <div className="flex items-center gap-2">
          {isCompleted && (
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          )}
          <p
            className={cn(
              "text-sm font-medium truncate",
              isCompleted && "line-through text-muted-foreground"
            )}
          >
            {task.name}
          </p>
        </div>
      </div>

      {status && (
        <Badge
          variant="outline"
          className={cn(
            "text-xs shrink-0",
            isCompleted && "bg-green-500/10 text-green-600 border-green-500/20"
          )}
        >
          {status.name}
        </Badge>
      )}

      {task.story_points && (
        <Badge variant="secondary" className="text-xs shrink-0">
          {task.story_points} SP
        </Badge>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onRemoveFromSprint(task.id);
        }}
        title="Remove from sprint"
      >
        <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
}

// Backlog Picker Dialog
function BacklogPickerDialog({
  open,
  onClose,
  backlogTasks,
  statuses,
  onAddToSprint,
}: {
  open: boolean;
  onClose: () => void;
  backlogTasks: Task[];
  statuses: Status[];
  onAddToSprint: (taskIds: string[]) => Promise<void>;
}) {
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = (taskId: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleAddSelected = async () => {
    if (selectedTasks.size === 0) return;
    setIsLoading(true);
    try {
      await onAddToSprint(Array.from(selectedTasks));
      setSelectedTasks(new Set());
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const totalPoints = backlogTasks
    .filter((t) => selectedTasks.has(t.id))
    .reduce((sum, t) => sum + (t.story_points || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Stories from Turbo Tasks</DialogTitle>
          <DialogDescription>
            Select stories to add to this sprint. {selectedTasks.size} selected
            {totalPoints > 0 && ` (${totalPoints} points)`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          {backlogTasks.length > 0 ? (
            <div className="space-y-2">
              {backlogTasks.map((task) => {
                const status = statuses.find((s) => s.id === task.status_id);
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedTasks.has(task.id)
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => handleToggle(task.id)}
                  >
                    <Checkbox
                      checked={selectedTasks.has(task.id)}
                      onCheckedChange={() => handleToggle(task.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.name}</p>
                    </div>
                    {status && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {status.name}
                      </Badge>
                    )}
                    {task.story_points && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {task.story_points} SP
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Archive className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No stories in Turbo Tasks</p>
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAddSelected}
            disabled={selectedTasks.size === 0 || isLoading}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add {selectedTasks.size} {selectedTasks.size === 1 ? "Story" : "Stories"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Delete Sprint Confirmation Dialog
function DeleteSprintDialog({
  open,
  sprint,
  taskCount,
  onClose,
  onConfirm,
}: {
  open: boolean;
  sprint: Sprint | null;
  taskCount: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Delete Sprint
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {sprint?.name}?
            {taskCount > 0 && (
              <span className="block mt-2 text-amber-500">
                {taskCount} {taskCount === 1 ? "task" : "tasks"} will be moved back to Turbo Tasks.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive hover:bg-destructive/90"
          >
            Delete Sprint
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Droppable sprint container
function DroppableSprint({
  sprint,
  children,
}: {
  sprint: Sprint;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `sprint-${sprint.id}`,
    data: { type: "sprint", sprint },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "transition-all duration-200",
        isOver && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background rounded-lg"
      )}
    >
      {children}
    </div>
  );
}

// Sprint Card Component
function SprintCard({
  sprint,
  tasks,
  statuses,
  backlogTasks,
  isExpanded,
  isActive,
  onToggleExpand,
  onTaskClick,
  onEditSprint,
  onDeleteSprint,
  onStartSprint,
  onCompleteSprint,
  onMoveTaskToSprint,
}: {
  sprint: Sprint;
  tasks: Task[];
  statuses: Status[];
  backlogTasks: Task[];
  isExpanded: boolean;
  isActive: boolean;
  onToggleExpand: () => void;
  onTaskClick: (task: Task) => void;
  onEditSprint: (sprint: Sprint) => void;
  onDeleteSprint: (sprint: Sprint, taskCount: number) => void;
  onStartSprint: (sprintId: string) => void;
  onCompleteSprint: (sprintId: string) => void;
  onMoveTaskToSprint: (taskId: string, sprintId: string | null) => Promise<void>;
}) {
  const [showBacklogPicker, setShowBacklogPicker] = useState(false);

  const completedStatuses = getCompletedStatuses(statuses);
  const sprintTasks = tasks.filter((t) => t.sprint_id === sprint.id);
  const completedTasks = sprintTasks.filter((t) =>
    completedStatuses.some((s) => s.id === t.status_id)
  );
  const totalPoints = sprintTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
  const completedPoints = completedTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
  const progress = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

  // Detect goal/task mismatch — sprint goal says tasks exist but none are loaded
  const goalMatch = sprint.goal?.match(/Complete (\d+) stories/);
  const expectedStories = goalMatch ? parseInt(goalMatch[1], 10) : 0;
  const hasTaskMismatch = expectedStories > 0 && sprintTasks.length === 0;

  const today = startOfDay(new Date());
  const startDate = sprint.start_date ? startOfDay(new Date(sprint.start_date)) : null;
  const endDate = sprint.end_date ? startOfDay(new Date(sprint.end_date)) : null;

  const getSprintStatus = () => {
    // Respect explicit DB status first
    if (sprint.status === "completed") return { label: "Completed", color: "bg-green-500", textColor: "text-green-500" };
    if (sprint.status === "active") return { label: "Active", color: "bg-emerald-500", textColor: "text-emerald-500" };
    if (sprint.status === "planned") return { label: "Planned", color: "bg-blue-500", textColor: "text-blue-500" };
    // Fallback to date logic only when status is NULL
    if (!startDate || !endDate) return { label: "Draft", color: "bg-gray-500", textColor: "text-gray-500" };
    if (isBefore(today, startDate)) return { label: "Planned", color: "bg-blue-500", textColor: "text-blue-500" };
    if (isAfter(today, endDate)) return { label: "Completed", color: "bg-green-500", textColor: "text-green-500" };
    return { label: "Active", color: "bg-emerald-500", textColor: "text-emerald-500" };
  };

  const sprintStatus = getSprintStatus();
  const daysRemaining = endDate ? differenceInDays(endDate, today) : null;

  const handleAddStoriesFromBacklog = async (taskIds: string[]) => {
    for (const taskId of taskIds) {
      await onMoveTaskToSprint(taskId, sprint.id);
    }
  };

  const handleRemoveFromSprint = (taskId: string) => {
    onMoveTaskToSprint(taskId, null);
  };

  return (
    <DroppableSprint sprint={sprint}>
      <Card
        className={cn(
          "overflow-hidden transition-all",
          isActive && "border-emerald-500/50 bg-emerald-950/5 dark:bg-emerald-950/20"
        )}
      >
        {/* Card Header - Always Visible */}
        <div
          className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={onToggleExpand}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform text-muted-foreground",
                  isExpanded && "rotate-90"
                )}
              />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{sprint.name}</h4>
                  <Badge className={cn("text-xs text-white", sprintStatus.color)}>
                    {sprintStatus.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {startDate ? format(startDate, "MMM d") : "Not set"}
                  {endDate && ` - ${format(endDate, "MMM d, yyyy")}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Quick Stats */}
              <div className="hidden sm:flex gap-4 text-sm text-muted-foreground">
                {hasTaskMismatch ? (
                  <span className="flex items-center gap-1 text-amber-500">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {expectedStories} stories not loaded
                  </span>
                ) : (
                  <>
                    <span>
                      {completedTasks.length}/{sprintTasks.length} stories
                    </span>
                    <span>
                      {completedPoints}/{totalPoints} pts
                    </span>
                  </>
                )}
                {daysRemaining !== null && daysRemaining >= 0 && isActive && (
                  <span className={cn(daysRemaining <= 2 && "text-amber-500")}>
                    {daysRemaining} days left
                  </span>
                )}
              </div>

              {/* Circular Progress */}
              <CircularProgress
                value={progress}
                size={36}
                strokeWidth={3}
                progressColor={isActive ? "stroke-emerald-500" : "stroke-primary"}
              />

              {/* Actions Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {sprintStatus.label === "Planned" && (
                    <DropdownMenuItem onClick={() => onStartSprint(sprint.id)}>
                      <Play className="h-4 w-4 mr-2" />
                      Start Sprint
                    </DropdownMenuItem>
                  )}
                  {sprintStatus.label === "Active" && (
                    <DropdownMenuItem onClick={() => onCompleteSprint(sprint.id)}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Complete Sprint
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onEditSprint(sprint)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Rename Sprint
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDeleteSprint(sprint, sprintTasks.length)}
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    Delete Sprint
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Goal - rendered as markdown for formatted sprint descriptions */}
          {sprint.goal && (
            <div className="text-sm text-muted-foreground mt-2 ml-7 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{sprint.goal}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t pt-4 px-4 pb-4 space-y-3">
            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Stories List */}
            <div className="space-y-2 pt-2">
              {sprintTasks.length > 0 ? (
                sprintTasks.map((task) => (
                  <SprintStoryRow
                    key={task.id}
                    task={task}
                    statuses={statuses}
                    onTaskClick={onTaskClick}
                    onRemoveFromSprint={handleRemoveFromSprint}
                  />
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No tasks in this sprint</p>
                  <p className="text-xs mt-1">Drag tasks here or add from Turbo Tasks</p>
                </div>
              )}
            </div>

            {/* Add from Backlog Button */}
            {backlogTasks.length > 0 && (
              <Button
                variant="ghost"
                className="w-full mt-2 text-emerald-600 hover:text-emerald-500 hover:bg-emerald-500/10"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBacklogPicker(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Stories from Turbo Tasks ({backlogTasks.length} available)
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Backlog Picker Dialog */}
      <BacklogPickerDialog
        open={showBacklogPicker}
        onClose={() => setShowBacklogPicker(false)}
        backlogTasks={backlogTasks}
        statuses={statuses}
        onAddToSprint={handleAddStoriesFromBacklog}
      />
    </DroppableSprint>
  );
}

// Collapsible Completed Sprints Section
function CompletedSprintsSection({
  sprints,
  tasks,
  statuses,
  backlogTasks,
  expandedSprints,
  onToggleSprintExpand,
  onTaskClick,
  onEditSprint,
  onDeleteSprint,
  onStartSprint,
  onCompleteSprint,
  onMoveTaskToSprint,
}: {
  sprints: Sprint[];
  tasks: Task[];
  statuses: Status[];
  backlogTasks: Task[];
  expandedSprints: Set<string>;
  onToggleSprintExpand: (sprintId: string) => void;
  onTaskClick: (task: Task) => void;
  onEditSprint: (sprint: Sprint) => void;
  onDeleteSprint: (sprint: Sprint, taskCount: number) => void;
  onStartSprint: (sprintId: string) => void;
  onCompleteSprint: (sprintId: string) => void;
  onMoveTaskToSprint: (taskId: string, sprintId: string | null) => Promise<void>;
}) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  if (sprints.length === 0) return null;

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3 hover:text-foreground transition-colors"
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 transition-transform",
            !isCollapsed && "rotate-90"
          )}
        />
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        Completed Sprints ({sprints.length})
      </button>

      {!isCollapsed && (
        <div className="space-y-4">
          {sprints.map((sprint) => (
            <SprintCard
              key={sprint.id}
              sprint={sprint}
              tasks={tasks}
              statuses={statuses}
              backlogTasks={backlogTasks}
              isExpanded={expandedSprints.has(sprint.id)}
              isActive={false}
              onToggleExpand={() => onToggleSprintExpand(sprint.id)}
              onTaskClick={onTaskClick}
              onEditSprint={onEditSprint}
              onDeleteSprint={onDeleteSprint}
              onStartSprint={onStartSprint}
              onCompleteSprint={onCompleteSprint}
              onMoveTaskToSprint={onMoveTaskToSprint}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Main SprintsView Component
export function SprintsView({
  tasks,
  sprints,
  statuses,
  expandedSprints,
  onToggleSprintExpand,
  onCreateSprint,
  onEditSprint,
  onDeleteSprint,
  onTaskClick,
  onMoveTaskToSprint,
  onStartSprint,
  onCompleteSprint,
}: SprintsViewProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [sprintToDelete, setSprintToDelete] = useState<{ sprint: Sprint; taskCount: number } | null>(null);
  const { toast } = useEnhancedToast();

  // Track which sprints we've already prompted about to avoid repeat toasts
  const promptedSprintsRef = useRef<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Get backlog tasks (tasks not in any sprint)
  const backlogTasks = useMemo(() => {
    return tasks.filter((t) => !t.sprint_id && !t.parent_task_id);
  }, [tasks]);

  // Group sprints by status
  const { activeSprints, plannedSprints, completedSprints } = useMemo(() => {
    const today = startOfDay(new Date());
    const active: Sprint[] = [];
    const planned: Sprint[] = [];
    const completed: Sprint[] = [];

    sprints.forEach((sprint) => {
      const startDate = sprint.start_date ? startOfDay(new Date(sprint.start_date)) : null;
      const endDate = sprint.end_date ? startOfDay(new Date(sprint.end_date)) : null;

      if (!startDate || !endDate) {
        planned.push(sprint);
      } else if (isAfter(today, endDate)) {
        completed.push(sprint);
      } else if (isBefore(today, startDate)) {
        planned.push(sprint);
      } else {
        active.push(sprint);
      }
    });

    return { activeSprints: active, plannedSprints: planned, completedSprints: completed };
  }, [sprints]);

  // Check if any active sprint has all tasks in a "done" status and prompt to complete
  useEffect(() => {
    if (activeSprints.length === 0) return;

    const completedStatuses = getCompletedStatuses(statuses);
    if (completedStatuses.length === 0) return;

    for (const sprint of activeSprints) {
      // Skip if we already prompted for this sprint
      if (promptedSprintsRef.current.has(sprint.id)) continue;

      const sprintTasks = tasks.filter((t) => t.sprint_id === sprint.id);
      // Only check sprints that actually have tasks
      if (sprintTasks.length === 0) continue;

      const allDone = sprintTasks.every((t) =>
        completedStatuses.some((s) => s.id === t.status_id)
      );

      if (allDone) {
        promptedSprintsRef.current.add(sprint.id);
        const sprintId = sprint.id;
        toast({
          title: `All tasks in "${sprint.name}" are done!`,
          description: `${sprintTasks.length} ${sprintTasks.length === 1 ? "task" : "tasks"} completed. Ready to wrap up this sprint?`,
          action: React.createElement(ToastAction, {
            altText: "Complete Sprint",
            onClick: () => onCompleteSprint(sprintId),
          }, "Complete Sprint"),
          duration: 15000,
        });
      }
    }
  }, [activeSprints, tasks, statuses, toast, onCompleteSprint]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (event.active.data.current?.type === "task") {
      setActiveTask(event.active.data.current.task);
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTask(null);
      if (!event.over) return;

      const activeData = event.active.data.current;
      const overData = event.over.data.current;

      if (activeData?.type === "task" && overData?.type === "sprint") {
        const task = activeData.task as Task;
        const sprint = overData.sprint as Sprint;
        if (task.sprint_id !== sprint.id) {
          await onMoveTaskToSprint(task.id, sprint.id);
        }
      }
    },
    [onMoveTaskToSprint]
  );

  const handleDeleteSprintClick = (sprint: Sprint, taskCount: number) => {
    setSprintToDelete({ sprint, taskCount });
  };

  const handleConfirmDelete = () => {
    if (sprintToDelete) {
      onDeleteSprint(sprintToDelete.sprint.id);
      setSprintToDelete(null);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Sprints</h2>
            <Badge variant="outline" className="text-xs">
              {sprints.length} total
            </Badge>
          </div>
          <Button onClick={onCreateSprint} className="bg-emerald-600 hover:bg-emerald-500">
            <Plus className="h-4 w-4 mr-2" />
            Create Sprint
          </Button>
        </div>

        {/* Active Sprints */}
        {activeSprints.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-medium text-emerald-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Play className="h-4 w-4" />
              Active Sprint{activeSprints.length > 1 ? "s" : ""}
            </h3>
            <div className="space-y-4">
              {activeSprints.map((sprint) => (
                <SprintCard
                  key={sprint.id}
                  sprint={sprint}
                  tasks={tasks}
                  statuses={statuses}
                  backlogTasks={backlogTasks}
                  isExpanded={expandedSprints.has(sprint.id)}
                  isActive
                  onToggleExpand={() => onToggleSprintExpand(sprint.id)}
                  onTaskClick={onTaskClick}
                  onEditSprint={onEditSprint}
                  onDeleteSprint={handleDeleteSprintClick}
                  onStartSprint={onStartSprint}
                  onCompleteSprint={onCompleteSprint}
                  onMoveTaskToSprint={onMoveTaskToSprint}
                />
              ))}
            </div>
          </div>
        )}

        {/* Planned Sprints */}
        {plannedSprints.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Upcoming ({plannedSprints.length})
            </h3>
            <div className="space-y-4">
              {plannedSprints.map((sprint) => (
                <SprintCard
                  key={sprint.id}
                  sprint={sprint}
                  tasks={tasks}
                  statuses={statuses}
                  backlogTasks={backlogTasks}
                  isExpanded={expandedSprints.has(sprint.id)}
                  isActive={false}
                  onToggleExpand={() => onToggleSprintExpand(sprint.id)}
                  onTaskClick={onTaskClick}
                  onEditSprint={onEditSprint}
                  onDeleteSprint={handleDeleteSprintClick}
                  onStartSprint={onStartSprint}
                  onCompleteSprint={onCompleteSprint}
                  onMoveTaskToSprint={onMoveTaskToSprint}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed Sprints (Collapsible) */}
        <CompletedSprintsSection
          sprints={completedSprints}
          tasks={tasks}
          statuses={statuses}
          backlogTasks={backlogTasks}
          expandedSprints={expandedSprints}
          onToggleSprintExpand={onToggleSprintExpand}
          onTaskClick={onTaskClick}
          onEditSprint={onEditSprint}
          onDeleteSprint={handleDeleteSprintClick}
          onStartSprint={onStartSprint}
          onCompleteSprint={onCompleteSprint}
          onMoveTaskToSprint={onMoveTaskToSprint}
        />

        {/* Empty State */}
        {sprints.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No sprints yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Create sprints to organize your work into time-boxed iterations.
              Drag tasks from Turbo Tasks to assign them to sprints.
            </p>
            <Button onClick={onCreateSprint} className="bg-emerald-600 hover:bg-emerald-500">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Sprint
            </Button>
          </div>
        )}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeTask && (
          <div className="p-3 rounded-lg border bg-background shadow-lg max-w-sm">
            <p className="text-sm font-medium truncate">{activeTask.name}</p>
            {activeTask.story_points && (
              <Badge variant="secondary" className="text-xs mt-1">
                {activeTask.story_points} SP
              </Badge>
            )}
          </div>
        )}
      </DragOverlay>

      {/* Delete Sprint Confirmation */}
      <DeleteSprintDialog
        open={!!sprintToDelete}
        sprint={sprintToDelete?.sprint || null}
        taskCount={sprintToDelete?.taskCount || 0}
        onClose={() => setSprintToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </DndContext>
  );
}
