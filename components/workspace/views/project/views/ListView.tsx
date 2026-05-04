/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/rules-of-hooks */
import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus,
  CalendarIcon,
  CircleUserRound,
  CheckIcon,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Goal,
  CircleDashed,
  CirclePlay,
  CircleCheck,
  Check,
  X,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DatePicker } from "@/components/workspace/components/date-picker";
import { format, parseISO } from "date-fns";
import { getAvatarInitials } from "@/lib/utils";
import { priorityConfig } from "../types";
import {
  getStatusColor,
  getStatusBadge,
  formatDateRange,
  getStatusTextColor,
  aggregateStatuses,
  taskMatchesColumn,
} from "../utils";
import { Status } from "@/lib/database-aliases";
import StatusSettingsModal from "@/components/workspace/modals/status-settings-modal";
import {
  DndContext,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";

interface ListViewProps {
  state: any;
  updateState: (updates: any) => void;
  taskOperations: any;
  getTaskSubtasks: (taskId: string) => any[];
  handleTaskClick: (task: any) => void;
  toggleTaskExpansion: (taskId: string, e: React.MouseEvent) => void;
  handleCreateSubtask: (parentId: string) => void;
  handleDeleteTask: (task: any) => void;
  tasks: any[];
  // Optional selection props for task selection feature
}

export const ListView: React.FC<ListViewProps> = ({
  state,
  updateState,
  taskOperations,
  getTaskSubtasks,
  handleTaskClick,
  toggleTaskExpansion,
  handleCreateSubtask,
  handleDeleteTask,
  tasks,
}) => {
  const [renamingStatusId, setRenamingStatusId] = React.useState<string | null>(
    null
  );
  const [newStatusName, setNewStatusName] = React.useState<string>("");
  const [openDropdownId, setOpenDropdownId] = React.useState<string | null>(
    null
  );
  const [statusSettingsModalOpen, setStatusSettingsModalOpen] =
    React.useState(false);
  const [statusToEdit, setStatusToEdit] = React.useState<any>(null);
  const renameInputRef = React.useRef<HTMLInputElement>(null);

  // DnD state
  const [activeTask, setActiveTask] = React.useState<any | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleRenameStatus = React.useCallback((status: any) => {
    setRenamingStatusId(status.id);
    setNewStatusName(status.name);
    // Focus the input immediately
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 10);
  }, []);

  const handleEditStatus = (status: any) => {
    setStatusToEdit(status);
    setStatusSettingsModalOpen(true);
    setOpenDropdownId(null); // Close the dropdown
  };

  const handleSaveRename = async (statusId: string) => {
    if (
      newStatusName.trim() &&
      newStatusName.trim() !==
        state.statuses.find((s: any) => s.id === statusId)?.name
    ) {
      try {
        // Use the taskOperations function that properly updates the database
        await taskOperations.handleRenameStatus(statusId, newStatusName.trim());
      } catch (error) {
        console.error("Failed to rename status:", error);
      }
    }
    setRenamingStatusId(null);
    setNewStatusName("");
  };

  const handleCancelRename = () => {
    setRenamingStatusId(null);
    setNewStatusName("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, statusId: string) => {
    if (e.key === "Enter") {
      handleSaveRename(statusId);
    } else if (e.key === "Escape") {
      handleCancelRename();
    }
  };

  if (state.isLoading) {
    return (
      <div className="flex-1 overflow-auto p-3">
        <div className="space-y-3">
          {[1, 2, 3].map((i: number) => (
            <div key={i} className="rounded-lg border workspace-border">
              <div className="flex items-center justify-between p-2 border-b workspace-border">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 workspace-secondary-sidebar-bg rounded-full animate-pulse" />
                  <div className="h-4 w-20 workspace-secondary-sidebar-bg rounded animate-pulse" />
                  <div className="h-4 w-6 workspace-secondary-sidebar-bg rounded animate-pulse" />
                </div>
              </div>
              <div className="p-2">
                {[1, 2, 3].map((j: number) => (
                  <div
                    key={j}
                    className="flex items-center space-x-2 py-2 border-b workspace-border last:border-b-0"
                  >
                    <div className="w-4 h-4 workspace-secondary-sidebar-bg rounded animate-pulse" />
                    <div className="h-4 w-1/3 workspace-secondary-sidebar-bg rounded animate-pulse" />
                    <div className="w-6 h-6 workspace-secondary-sidebar-bg rounded-full animate-pulse" />
                    <div className="h-4 w-16 workspace-secondary-sidebar-bg rounded animate-pulse" />
                    <div className="w-2 h-2 workspace-secondary-sidebar-bg rounded-full animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Aggregate all statuses into canonical columns, including Backlog
  const { columns, statusIdsByColumn } = aggregateStatuses(state.statuses, false);

  // All known status IDs (including not-started)
  const allKnownStatusIds = new Set(state.statuses.map((s: any) => s.id));
  const firstColumnId = columns.length > 0 ? columns[0].id : "unknown";

  const tasksByStatusForList = tasks
    .filter((task) => !task.parent_task_id && !task.deleted_at)
    .reduce((acc, task) => {
      // Find which canonical column this task belongs to
      const matchedColumn = columns.find((col: any) =>
        taskMatchesColumn(task, col, statusIdsByColumn)
      );

      if (matchedColumn) {
        if (!acc[matchedColumn.id]) acc[matchedColumn.id] = [];
        acc[matchedColumn.id].push(task);
      } else if (task.status_id && allKnownStatusIds.has(task.status_id)) {
        // Known status but mapped to excluded column (Backlog) — skip (Turbo Tasks tab)
      } else {
        // Orphaned task — show in first column
        if (!acc[firstColumnId]) acc[firstColumnId] = [];
        acc[firstColumnId].push(task);
      }
      return acc;
    }, {} as Record<string, any[]>);

  const handleCopyLink = (task: any) => {
    const taskUrl = `${window.location.origin}/${task.workspace_id}/task/${task.task_id}`;
    navigator.clipboard.writeText(taskUrl);
  };

  const getStatusIcon = (statusType: string, statusColor: Status) => {
    switch (statusType?.toLowerCase()) {
      case "not-started":
        return (
          <CircleDashed
            className={`h-4 w-4 ${getStatusTextColor(statusColor)}`}
          />
        );
      case "active":
        return (
          <CirclePlay
            className={`h-4 w-4 ${getStatusTextColor(statusColor)}`}
          />
        );
      case "done":
        return (
          <CircleCheck
            className={`h-4 w-4 ${getStatusTextColor(statusColor)}`}
          />
        );
      case "closed":
        return (
          <CircleCheck
            className={`h-4 w-4 ${getStatusTextColor(statusColor)}`}
          />
        );
      default:
        return (
          <div
            className={`w-3 h-3 ${getStatusColor(statusColor)} rounded-full`}
          />
        );
    }
  };

  const StatusDroppable: React.FC<{
    statusId: string;
    children: React.ReactNode;
  }> = ({ statusId, children }) => {
    const { setNodeRef, isOver } = useDroppable({ id: statusId });
    return (
      <div
        ref={setNodeRef}
        id={`status-content-${statusId}`}
        className={`relative rounded-md ${
          isOver ? "outline outline-2 outline-workspace-primary/70" : ""
        }`}
      >
        {children}
        {isOver && (
          <div className="pointer-events-none absolute -top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-workspace-primary/90 text-white shadow">
            Drop to move here
          </div>
        )}
      </div>
    );
  };

  const DraggableRow: React.FC<{ id: string; children: React.ReactNode }> = ({
    id,
    children,
  }) => {
    const { attributes, listeners, setNodeRef } = useDraggable({ id });
    return (
      <TableRow
        ref={setNodeRef as any}
        className="cursor-pointer hover:workspace-hover h-8 text-xs"
        {...attributes}
        {...listeners}
      >
        {children}
      </TableRow>
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const dragged = tasks.find((t) => t.id === active.id);
    if (dragged) setActiveTask(dragged);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      setActiveTask(null);
      return;
    }
    try {
      // Delegate to upstream taskOperations if available (project/my-tasks will implement)
      if (
        taskOperations &&
        typeof taskOperations.handleDragEnd === "function"
      ) {
        await taskOperations.handleDragEnd(active, over);
      }
    } finally {
      setActiveTask(null);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 overflow-auto p-3">
        <div className="space-y-3">
          {columns.map((status: any) => {
            const statusTasks = tasksByStatusForList[status.id] || [];
            return (
              <div
                key={status.id}
                className="workspace-secondary-sidebar-bg rounded-lg border workspace-border"
              >
                <div className="flex items-center justify-between p-2 border-b workspace-border">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:workspace-hover"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        const newCollapsedStatuses = new Set(
                          state.collapsedStatuses
                        );
                        if (newCollapsedStatuses.has(status.id)) {
                          newCollapsedStatuses.delete(status.id);
                        } else {
                          newCollapsedStatuses.add(status.id);
                        }
                        updateState({
                          collapsedStatuses: newCollapsedStatuses,
                        });
                      }}
                    >
                      {state.collapsedStatuses.has(status.id) ? (
                        <ChevronRight className="h-4 w-4 workspace-sidebar-text" />
                      ) : (
                        <ChevronDown className="h-4 w-4 workspace-sidebar-text" />
                      )}
                    </Button>
                    {getStatusIcon(status.status_type?.name, status)}
                    {renamingStatusId === status.id ? (
                      <div className="flex items-center space-x-1">
                        <Input
                          ref={renameInputRef}
                          type="text"
                          value={newStatusName}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewStatusName(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, status.id)}
                          className="w-24 h-6 text-xs workspace-component-active-color"
                          onBlur={() => handleSaveRename(status.id)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:workspace-hover"
                          onClick={() => handleSaveRename(status.id)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:workspace-hover"
                          onClick={handleCancelRename}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <h3 className="font-medium workspace-sidebar-text">
                        {status.name}
                      </h3>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {statusTasks.length}
                    </Badge>

                    <Badge
                      className={`text-xs text-white ${getStatusColor(status)}`}
                    >
                      {getStatusBadge(status)}
                    </Badge>
                  </div>
                </div>

                {!state.collapsedStatuses.has(status.id) && (
                  <StatusDroppable statusId={status.id}>
                    <div className="overflow-x-auto -mx-2 px-2">
                    <Table className="min-w-[600px]">
                      <TableHeader className="p-2 h-8">
                        <TableRow>
                          <TableHead className="workspace-sidebar-text text-xs p-2">
                            Name
                          </TableHead>
                          {state.visibleColumns.has("assignee") && (
                            <TableHead className="workspace-sidebar-text text-xs p-2">
                              Assignee
                            </TableHead>
                          )}
                          {state.visibleColumns.has("dueDate") && (
                            <TableHead className="workspace-sidebar-text text-xs p-2">
                              Due date
                            </TableHead>
                          )}
                          {state.visibleColumns.has("priority") && (
                            <TableHead className="workspace-sidebar-text text-xs p-2">
                              Priority
                            </TableHead>
                          )}
                          {state.visibleColumns.has("subtasks") && (
                            <TableHead className="workspace-sidebar-text text-xs p-2">
                              Subtasks
                            </TableHead>
                          )}
                          {state.visibleColumns.has("createdAt") && (
                            <TableHead className="workspace-sidebar-text text-xs p-2">
                              Date created
                            </TableHead>
                          )}
                          {state.visibleColumns.has("sprints") && (
                            <TableHead className="workspace-sidebar-text text-xs p-2">
                              Sprints
                            </TableHead>
                          )}
                          {state.visibleColumns.has("sprintPoints") && (
                            <TableHead className="workspace-sidebar-text text-xs p-2">
                              Sprint points
                            </TableHead>
                          )}
                          {state.visibleColumns.has("createdBy") && (
                            <TableHead className="workspace-sidebar-text text-xs p-2">
                              Created by
                            </TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statusTasks.map((task: any) => {
                          const subtasks = getTaskSubtasks(task.id);
                          const isExpanded = state.expandedTasks.has(task.id);

                          return (
                            <React.Fragment key={task.id}>
                              <DraggableRow id={task.id}>
                                <TableCell
                                  className="font-medium p-2 cursor-pointer hover:underline"
                                  onClick={() => {
                                    handleTaskClick(task);
                                  }}
                                >
                                  {task.name}
                                </TableCell>
                                {state.visibleColumns.has("assignee") && (
                                  <TableCell className="p-2">
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => e.stopPropagation()}
                                          className="h-6 w-6 p-0"
                                        >
                                          {task.assignee ? (
                                            <Avatar className="h-6 w-6">
                                              <AvatarImage
                                                src={
                                                  task.assignee?.avatar_url ??
                                                  undefined
                                                }
                                                alt={
                                                  task.assignee?.full_name ||
                                                  "User"
                                                }
                                              />
                                              <AvatarFallback className="text-xs workspace-component-bg workspace-component-active-color">
                                                {getAvatarInitials(
                                                  task.assignee?.full_name,
                                                  task.assignee?.email
                                                )}
                                              </AvatarFallback>
                                            </Avatar>
                                          ) : (
                                            <div className="h-6 w-6 border workspace-border flex items-center justify-center rounded-sm">
                                              <CircleUserRound className="h-3 w-3 workspace-sidebar-text" />
                                            </div>
                                          )}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-[200px] p-0">
                                        <Command>
                                          <CommandInput placeholder="Search user..." />
                                          <CommandList>
                                            <CommandEmpty>
                                              No users found.
                                            </CommandEmpty>
                                            <CommandGroup>
                                              <CommandItem
                                                onSelect={() =>
                                                  taskOperations.handleAssignTask(
                                                    task.id,
                                                    null
                                                  )
                                                }
                                                className="flex items-center justify-between cursor-pointer"
                                                onClick={(e: React.MouseEvent) =>
                                                  e.stopPropagation()
                                                }
                                              >
                                                <span className="text-xs">
                                                  Unassign
                                                </span>
                                                {!task.assignee_id && (
                                                  <CheckIcon className="ml-auto h-4 w-4" />
                                                )}
                                              </CommandItem>

                                              {/* Workspace Members (Profile Users) */}
                                              {state.workspaceMembers.length >
                                                0 && (
                                                <>
                                                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                                    Workspace Members
                                                  </div>
                                                  {state.workspaceMembers.map(
                                                    (member: any) => (
                                                      <CommandItem
                                                        key={`profile-${member.id}`}
                                                        onSelect={() =>
                                                          taskOperations.handleAssignTask(
                                                            task.id,
                                                            member.id
                                                          )
                                                        }
                                                        className="flex items-center justify-between cursor-pointer"
                                                        onClick={(e: React.MouseEvent) =>
                                                          e.stopPropagation()
                                                        }
                                                      >
                                                        <div className="flex items-center space-x-2">
                                                          <Avatar className="h-6 w-6">
                                                            <AvatarFallback className="text-xs h-6 w-6 workspace-component-bg workspace-component-active-color">
                                                              {getAvatarInitials(
                                                                member.full_name,
                                                                member.email
                                                              )}
                                                            </AvatarFallback>
                                                          </Avatar>
                                                          <span className="text-xs">
                                                            {member.full_name}
                                                          </span>
                                                        </div>
                                                        {task.assignee_id ===
                                                          member.id && (
                                                          <CheckIcon className="ml-auto h-4 w-4" />
                                                        )}
                                                      </CommandItem>
                                                    )
                                                  )}
                                                </>
                                              )}

                                            </CommandGroup>
                                          </CommandList>
                                        </Command>
                                      </PopoverContent>
                                    </Popover>
                                  </TableCell>
                                )}
                                {state.visibleColumns.has("dueDate") && (
                                  <TableCell className="p-2 flex items-center">
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => e.stopPropagation()}
                                          className="h-6 w-auto p-1 flex items-center justify-center text-xs hover:workspace-hover border workspace-border rounded-sm "
                                        >
                                          <div className="flex items-center">
                                            <CalendarIcon className="h-4 w-4 workspace-sidebar-text" />
                                            <span
                                              className={`workspace-sidebar-text ${
                                                task.due_date || task.start_date
                                                  ? "ml-1"
                                                  : ""
                                              }`}
                                            >
                                              {formatDateRange(
                                                task.start_date || undefined,
                                                task.due_date || undefined
                                              )}
                                            </span>
                                          </div>
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        className="w-auto p-0"
                                        align="start"
                                      >
                                        <div className="p-3">
                                          <div className="space-y-4">
                                            <DatePicker
                                              startDate={task.start_date}
                                              dueDate={task.due_date}
                                              onDateChange={(
                                                startDate: Date | null,
                                                dueDate: Date | null
                                              ) =>
                                                taskOperations.handleUpdateDates(
                                                  task.id,
                                                  startDate?.toISOString() || null,
                                                  dueDate?.toISOString() || null
                                                )
                                              }
                                            />
                                          </div>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </TableCell>
                                )}
                                {state.visibleColumns.has("priority") && (
                                  <TableCell className="p-2">
                                    {task.priority ? (
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-1 flex items-center justify-center text-xs hover:workspace-hover border workspace-border rounded-sm"
                                          >
                                            <Goal
                                              className={`w-4 h-4 ${
                                                priorityConfig[
                                                  task.priority as keyof typeof priorityConfig
                                                ]?.color
                                              }`}
                                            />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[200px] p-0">
                                          <Command>
                                            <CommandInput placeholder="Set priority..." />
                                            <CommandList>
                                              <CommandEmpty>
                                                No priority found.
                                              </CommandEmpty>
                                              <CommandGroup>
                                                <CommandItem
                                                  onSelect={() =>
                                                    taskOperations.handleUpdatePriority(
                                                      task.id,
                                                      null
                                                    )
                                                  }
                                                  className="flex items-center justify-between cursor-pointer"
                                                  onClick={(e: React.MouseEvent) =>
                                                    e.stopPropagation()
                                                  }
                                                >
                                                  <span>No priority</span>
                                                  {!task.priority && (
                                                    <CheckIcon className="ml-auto h-4 w-4" />
                                                  )}
                                                </CommandItem>
                                                {Object.entries(
                                                  priorityConfig
                                                ).map(([key, config]: [string, { label: string; color: string }]) => (
                                                  <CommandItem
                                                    key={key}
                                                    onSelect={() =>
                                                      taskOperations.handleUpdatePriority(
                                                        task.id,
                                                        key
                                                      )
                                                    }
                                                    className="flex items-center justify-between cursor-pointer"
                                                    onClick={(e: React.MouseEvent) =>
                                                      e.stopPropagation()
                                                    }
                                                  >
                                                    <div className="flex items-center">
                                                      <Goal
                                                        className={`h-4 w-4 mr-2 ${config.color}`}
                                                      />
                                                      <span>
                                                        {config.label}
                                                      </span>
                                                    </div>
                                                    {task.priority === key && (
                                                      <CheckIcon className="ml-auto h-4 w-4" />
                                                    )}
                                                  </CommandItem>
                                                ))}
                                              </CommandGroup>
                                            </CommandList>
                                          </Command>
                                        </PopoverContent>
                                      </Popover>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-1 flex items-center justify-center text-xs hover:workspace-hover border workspace-border rounded-sm"
                                        onClick={() =>
                                          taskOperations.handleUpdatePriority(
                                            task.id,
                                            "medium"
                                          )
                                        }
                                      >
                                        <Goal className="w-4 h-4 workspace-sidebar-text" />
                                      </Button>
                                    )}
                                  </TableCell>
                                )}
                                {state.visibleColumns.has("subtasks") && (
                                  <TableCell className="p-2">
                                    {subtasks.length > 0 && (
                                      <button
                                        className="flex items-center text-xs workspace-sidebar-text"
                                        onClick={(e) =>
                                          toggleTaskExpansion(task.id, e)
                                        }
                                      >
                                        <span>{subtasks.length} subtasks</span>
                                        {isExpanded ? (
                                          <ChevronDown className="h-3 w-3" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3" />
                                        )}
                                      </button>
                                    )}
                                  </TableCell>
                                )}
                                {state.visibleColumns.has("createdAt") && (
                                  <TableCell className="p-2">
                                    {task.created_at &&
                                      format(
                                        parseISO(task.created_at),
                                        "MMM d, yyyy"
                                      )}
                                  </TableCell>
                                )}
                                {state.visibleColumns.has("sprints") && (
                                  <TableCell className="p-2">
                                    <Badge variant="outline">Sprint 1</Badge>
                                  </TableCell>
                                )}
                                {state.visibleColumns.has("sprintPoints") && (
                                  <TableCell className="p-2">
                                    <span>5 pts</span>
                                  </TableCell>
                                )}
                                {state.visibleColumns.has("createdBy") && (
                                  <TableCell className="p-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                    >
                                      {task.created_by_profile ? (
                                        <Avatar className="h-6 w-6">
                                          <AvatarImage
                                            src={
                                              task.created_by_profile
                                                ?.avatar_url ?? undefined
                                            }
                                            alt={
                                              task.created_by_profile
                                                ?.full_name || "User"
                                            }
                                          />
                                          <AvatarFallback className="text-xs workspace-component-bg workspace-component-active-color">
                                            {getAvatarInitials(
                                              task.created_by_profile
                                                ?.full_name,
                                              task.created_by_profile?.email
                                            )}
                                          </AvatarFallback>
                                        </Avatar>
                                      ) : (
                                        <div className="h-6 w-6 border workspace-border flex items-center justify-center rounded-sm">
                                          <CircleUserRound className="h-3 w-3 workspace-sidebar-text" />
                                        </div>
                                      )}
                                    </Button>
                                  </TableCell>
                                )}
                              </DraggableRow>

                              {isExpanded &&
                                subtasks.map((subtask) => (
                                  <TableRow
                                    key={subtask.id}
                                    className="cursor-pointer text-xs workspace-sidebar-text h-8 hover:workspace-hover"
                                    onClick={() => handleTaskClick(subtask)}
                                  >
                                    <TableCell className="w-10 px-2"></TableCell>
                                    <TableCell className="pl-8 flex items-center text-xs workspace-sidebar-text p-2">
                                      <GitBranch className="h-4 w-4 mr-2" />
                                      {subtask.name}
                                    </TableCell>
                                    {state.visibleColumns.has("assignee") && (
                                      <TableCell className="p-2">
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0"
                                            >
                                              {subtask.assignee ? (
                                                <Avatar className="h-6 w-6">
                                                  <AvatarImage
                                                    src={
                                                      subtask.assignee
                                                        ?.avatar_url ??
                                                      undefined
                                                    }
                                                    alt={
                                                      subtask.assignee
                                                        ?.full_name || "User"
                                                    }
                                                  />
                                                  <AvatarFallback className="text-xs workspace-component-bg workspace-component-active-color">
                                                    {getAvatarInitials(
                                                      subtask.assignee
                                                        ?.full_name,
                                                      subtask.assignee?.email
                                                    )}
                                                  </AvatarFallback>
                                                </Avatar>
                                              ) : (
                                                <div className="h-6 w-6 border workspace-border flex items-center justify-center rounded-sm">
                                                  <CircleUserRound className="h-3 w-3 workspace-sidebar-text" />
                                                </div>
                                              )}
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-[200px] p-0">
                                            <Command>
                                              <CommandInput placeholder="Search user..." />
                                              <CommandList>
                                                <CommandEmpty>
                                                  No users found.
                                                </CommandEmpty>
                                                <CommandGroup>
                                                  <CommandItem
                                                    onSelect={() =>
                                                      taskOperations.handleAssignTask(
                                                        subtask.id,
                                                        null
                                                      )
                                                    }
                                                    className="flex items-center justify-between"
                                                  >
                                                    <span>Unassign</span>
                                                    {!subtask.assignee_id && (
                                                      <CheckIcon className="ml-auto h-4 w-4" />
                                                    )}
                                                  </CommandItem>

                                                  {/* Workspace Members (Profile Users) */}
                                                  {state.workspaceMembers
                                                    .length > 0 && (
                                                    <>
                                                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                                        Workspace Members
                                                      </div>
                                                      {state.workspaceMembers.map(
                                                        (member: any) => (
                                                          <CommandItem
                                                            key={`profile-${member.id}`}
                                                            onSelect={() =>
                                                              taskOperations.handleAssignTask(
                                                                subtask.id,
                                                                member.id
                                                              )
                                                            }
                                                            className="flex items-center justify-between"
                                                          >
                                                            <div className="flex items-center space-x-2">
                                                              <Avatar className="h-6 w-6">
                                                                <AvatarFallback className="text-xs">
                                                                  {getAvatarInitials(
                                                                    member.full_name,
                                                                    member.email
                                                                  )}
                                                                </AvatarFallback>
                                                              </Avatar>
                                                              <span>
                                                                {
                                                                  member.full_name
                                                                }
                                                              </span>
                                                            </div>
                                                            {subtask.assignee_id ===
                                                              member.id && (
                                                              <CheckIcon className="ml-auto h-4 w-4" />
                                                            )}
                                                          </CommandItem>
                                                        )
                                                      )}
                                                    </>
                                                  )}

                                                </CommandGroup>
                                              </CommandList>
                                            </Command>
                                          </PopoverContent>
                                        </Popover>
                                      </TableCell>
                                    )}
                                    {state.visibleColumns.has("dueDate") && (
                                      <TableCell className="text-xs p-2">
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                              className="h-6 w-auto p-1 flex items-center justify-center text-xs hover:workspace-hover border workspace-border rounded-sm "
                                            >
                                              <div className="flex items-center">
                                                <CalendarIcon className="h-4 w-4 workspace-sidebar-text" />
                                                <span
                                                  className={`workspace-sidebar-text ${
                                                    subtask.due_date ||
                                                    subtask.start_date
                                                      ? "ml-1"
                                                      : ""
                                                  }`}
                                                >
                                                  {formatDateRange(
                                                    subtask.start_date ||
                                                      undefined,
                                                    subtask.due_date ||
                                                      undefined
                                                  )}
                                                </span>
                                              </div>
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent
                                            className="w-auto p-0"
                                            align="start"
                                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                          >
                                            <div className="p-3">
                                              <div className="space-y-4">
                                                <DatePicker
                                                  startDate={subtask.start_date}
                                                  dueDate={subtask.due_date}
                                                  onDateChange={(
                                                    startDate: Date | null,
                                                    dueDate: Date | null
                                                  ) =>
                                                    taskOperations.handleUpdateDates(
                                                      subtask.id,
                                                      startDate?.toISOString() || null,
                                                      dueDate?.toISOString() || null
                                                    )
                                                  }
                                                />
                                              </div>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      </TableCell>
                                    )}
                                    {state.visibleColumns.has("priority") && (
                                      <TableCell className="p-2">
                                        {subtask.priority ? (
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e: React.MouseEvent<HTMLButtonElement>) =>
                                                  e.stopPropagation()
                                                }
                                                className="h-6 w-6 p-1 flex items-center justify-center text-xs hover:workspace-hover border workspace-border rounded-sm"
                                              >
                                                <Goal
                                                  className={`w-4 h-4 ${
                                                    priorityConfig[
                                                      subtask.priority as keyof typeof priorityConfig
                                                    ]?.color
                                                  }`}
                                                />
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[200px] p-0">
                                              <Command>
                                                <CommandInput placeholder="Set priority..." />
                                                <CommandList>
                                                  <CommandEmpty>
                                                    No priority found.
                                                  </CommandEmpty>
                                                  <CommandGroup>
                                                    <CommandItem
                                                      onSelect={() =>
                                                        taskOperations.handleUpdatePriority(
                                                          subtask.id,
                                                          null
                                                        )
                                                      }
                                                      className="flex items-center justify-between"
                                                    >
                                                      <span>No priority</span>
                                                      {!subtask.priority && (
                                                        <CheckIcon className="ml-auto h-4 w-4" />
                                                      )}
                                                    </CommandItem>
                                                    {Object.entries(
                                                      priorityConfig
                                                    ).map(([key, config]: [string, { label: string; color: string }]) => (
                                                      <CommandItem
                                                        key={key}
                                                        onSelect={() =>
                                                          taskOperations.handleUpdatePriority(
                                                            subtask.id,
                                                            key
                                                          )
                                                        }
                                                        className="flex items-center justify-between"
                                                      >
                                                        <div className="flex items-center">
                                                          <Goal
                                                            className={`h-4 w-4 mr-2 ${config.color}`}
                                                          />
                                                          <span>
                                                            {config.label}
                                                          </span>
                                                        </div>
                                                        {subtask.priority ===
                                                          key && (
                                                          <CheckIcon className="ml-auto h-4 w-4" />
                                                        )}
                                                      </CommandItem>
                                                    ))}
                                                  </CommandGroup>
                                                </CommandList>
                                              </Command>
                                            </PopoverContent>
                                          </Popover>
                                        ) : (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-auto p-0 text-xs hover:workspace-hover"
                                            onClick={() =>
                                              taskOperations.handleUpdatePriority(
                                                subtask.id,
                                                "medium"
                                              )
                                            }
                                          >
                                            <Goal className="w-4 h-4 workspace-sidebar-text" />
                                          </Button>
                                        )}
                                      </TableCell>
                                    )}
                                    {state.visibleColumns.has("subtasks") && (
                                      <TableCell className="p-2"></TableCell>
                                    )}
                                    {state.visibleColumns.has("createdAt") && (
                                      <TableCell className="p-2">
                                        {subtask.created_at &&
                                          format(
                                            parseISO(subtask.created_at),
                                            "MMM d, yyyy"
                                          )}
                                      </TableCell>
                                    )}
                                    {state.visibleColumns.has("sprints") && (
                                      <TableCell className="p-2">
                                        <Badge variant="outline">
                                          Sprint 1
                                        </Badge>
                                      </TableCell>
                                    )}
                                    {state.visibleColumns.has(
                                      "sprintPoints"
                                    ) && (
                                      <TableCell className="p-2">
                                        <span>3 pts</span>
                                      </TableCell>
                                    )}
                                    {state.visibleColumns.has("createdBy") && (
                                      <TableCell className="p-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                        >
                                          {subtask.created_by_profile ? (
                                            <Avatar className="h-6 w-6">
                                              <AvatarImage
                                                src={
                                                  subtask.created_by_profile
                                                    ?.avatar_url ?? undefined
                                                }
                                                alt={
                                                  subtask.created_by_profile
                                                    ?.full_name || "User"
                                                }
                                              />
                                              <AvatarFallback className="text-xs workspace-component-bg workspace-component-active-color">
                                                {getAvatarInitials(
                                                  subtask.created_by_profile
                                                    ?.full_name,
                                                  subtask.created_by_profile
                                                    ?.email
                                                )}
                                              </AvatarFallback>
                                            </Avatar>
                                          ) : (
                                            <div className="h-6 w-6 border workspace-border flex items-center justify-center rounded-sm">
                                              <CircleUserRound className="h-3 w-3 workspace-sidebar-text" />
                                            </div>
                                          )}
                                        </Button>
                                      </TableCell>
                                    )}
                                  </TableRow>
                                ))}
                            </React.Fragment>
                          );
                        })}
                        <TableRow>
                          <TableCell colSpan={100} className="p-2">
                            <Button
                              variant="ghost"
                              className="w-full justify-start text-xs hover:workspace-hover"
                              onClick={() =>
                                updateState({ createTaskModalOpen: true })
                              }
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Task
                            </Button>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                    </div>
                  </StatusDroppable>
                )}
              </div>
            );
          })}
        </div>

        {/* Status Settings Modal */}
        <StatusSettingsModal
          open={statusSettingsModalOpen}
          onOpenChange={setStatusSettingsModalOpen}
          status={statusToEdit}
          onSave={taskOperations.handleUpdateStatusSettings}
          statusTypes={state.statusTypes || []}
          workspace={state.workspace}
          space={state.space}
          project={state.project}
        />
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="rounded-md border workspace-border bg-background shadow-lg px-3 py-2 text-xs min-w-[300px] max-w-[480px]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{activeTask.name}</div>
                {activeTask.description && (
                  <div className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                    {activeTask.description}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {activeTask.priority ? (
                  <Goal
                    className={`w-4 h-4 ${
                      priorityConfig[
                        activeTask.priority as keyof typeof priorityConfig
                      ]?.color
                    }`}
                  />
                ) : null}
                {activeTask.due_date ? (
                  <CalendarIcon className="w-4 h-4" />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
