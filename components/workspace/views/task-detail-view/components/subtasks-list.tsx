"use client";

/* eslint-disable @typescript-eslint/no-unused-vars, react/no-unescaped-entities */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


import {
  Plus,
  CheckSquare,
  Square,
  Trash2,
  CalendarIcon,
  GitBranch,
  Goal,
  User,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { getAvatarInitials, cn } from "@/lib/utils";
import { priorityConfig } from "../../project/types";
import { getCompletedStatus } from "../utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { SubtasksListProps } from "../types";
import type { Task, Profile } from "@/lib/database-aliases";

// Priority badge colors
const priorityBadgeColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

export function SubtasksList({
  subtasks,
  statuses,
  workspaceMembers,
  workspace,
  completedSubtasks,
  isAddingSubtask,
  newSubtaskName,
  loading,
  deleteDialogOpen,
  onAddSubtask,
  onToggleAddSubtask,
  onNewSubtaskNameChange,
  onHandleAddSubtask,
  onToggleSubtaskComplete,
  onDeleteSubtask,
  onUpdateSubtaskAssignee,
  onUpdateSubtaskPriority,
  onUpdateSubtaskDueDate,
  onSetDeleteDialogOpen,
}: SubtasksListProps) {
  const isMobile = useIsMobile();
  const completedStatus = getCompletedStatus(statuses);
  const progress = subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0;

  // Mobile Card Component for each subtask
  const MobileSubtaskCard = ({ subtask }: { subtask: Task }) => {
    const isCompleted = subtask.status_id === completedStatus?.id;
    const priorityColor = subtask.priority
      ? priorityBadgeColors[subtask.priority as keyof typeof priorityBadgeColors]
      : null;

    return (
      <Card
        className={cn(
          "p-3 workspace-header-bg border workspace-border transition-colors",
          "active:bg-muted/50"
        )}
        onClick={() => {
          window.location.href = `/${workspace.workspace_id}/task/${subtask.task_id}`;
        }}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSubtaskComplete(subtask);
            }}
            className="shrink-0 mt-0.5 min-h-[44px] min-w-[44px] flex items-center justify-center -m-2"
          >
            {isCompleted ? (
              <CheckSquare className="h-5 w-5 text-green-600" />
            ) : (
              <Square className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm font-medium workspace-sidebar-text mb-2",
              isCompleted && "line-through text-muted-foreground"
            )}>
              {subtask.name}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Assignee */}
              {subtask.assignee ? (
                <div className="flex items-center gap-1">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={subtask.assignee.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getAvatarInitials(subtask.assignee.full_name, subtask.assignee.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                    {subtask.assignee.full_name?.split(' ')[0]}
                  </span>
                </div>
              ) : (
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                >
                  <User className="h-3 w-3" />
                  <span>Assign</span>
                </button>
              )}

              {/* Priority */}
              {subtask.priority && priorityColor && (
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", priorityColor)}>
                  {priorityConfig[subtask.priority as keyof typeof priorityConfig]?.label}
                </span>
              )}

              {/* Due Date */}
              {subtask.due_date && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarIcon className="h-3 w-3" />
                  {format(parseISO(subtask.due_date), "MMM d")}
                </span>
              )}
            </div>
          </div>

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSetDeleteDialogOpen(subtask.id);
            }}
            className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center -m-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </Card>
    );
  };

  return (
    <div>
      {/* Header with progress */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-md flex items-center justify-center shadow-sm">
            <GitBranch className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="text-lg font-semibold workspace-sidebar-text">
            Subtasks
          </h3>
          <span className="text-xs px-2 py-0.5 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded-full font-medium">
            {completedSubtasks}/{subtasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddSubtask}
          className="workspace-sidebar-text h-9 px-3 hover:bg-cyan-100 hover:text-cyan-700 dark:hover:bg-cyan-900/30 dark:hover:text-cyan-400 transition-colors"
        >
          <Plus className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Add Task</span>
        </Button>
      </div>

      {/* Progress Bar */}
      {subtasks.length > 0 && (
        <div className="mb-4">
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                progress === 100
                  ? "bg-gradient-to-r from-green-500 to-emerald-500"
                  : "bg-gradient-to-r from-cyan-500 to-blue-500"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Mobile Card View */}
      {isMobile ? (
        <div className="space-y-2">
          {subtasks.map((subtask: Task) => (
            <MobileSubtaskCard key={subtask.id} subtask={subtask} />
          ))}

          {/* Mobile Add Subtask */}
          {isAddingSubtask && (
            <Card className="p-3 workspace-header-bg border workspace-border border-dashed">
              <div className="flex items-center gap-3">
                <Square className="h-5 w-5 text-muted-foreground shrink-0" />
                <Input
                  value={newSubtaskName}
                  onChange={(e) => onNewSubtaskNameChange(e.target.value)}
                  placeholder="Enter subtask name..."
                  className="flex-1 h-10 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onHandleAddSubtask();
                    } else if (e.key === "Escape") {
                      onToggleAddSubtask(false);
                      onNewSubtaskNameChange("");
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onToggleAddSubtask(false);
                    onNewSubtaskNameChange("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={onHandleAddSubtask}
                  disabled={loading || !newSubtaskName.trim()}
                >
                  Add
                </Button>
              </div>
            </Card>
          )}

          {/* Mobile Empty State */}
          {subtasks.length === 0 && !isAddingSubtask && (
            <Card className="p-8 workspace-header-bg border workspace-border">
              <div className="text-center">
                <GitBranch className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground mb-4">
                  No subtasks yet. Break down this task into smaller pieces.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddSubtask}
                  className="h-10"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add first subtask
                </Button>
              </div>
            </Card>
          )}
        </div>
      ) : (
        /* Desktop Table View */
        <div className="workspace-sidebar-bg border workspace-border rounded-lg workspace-sidebar-text">
          {/* Subtasks Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 p-3 border-b workspace-border text-xs font-medium workspace-sidebar-text uppercase tracking-wide">
            <div className="col-span-4">Name</div>
            <div className="col-span-3">Assignee</div>
            <div className="col-span-2">Priority</div>
            <div className="col-span-2">Due date</div>
            <div className="col-span-1">Actions</div>
          </div>

        {/* Subtasks List */}
        <div>
          {subtasks.map((subtask: Task) => {
            const completedStatus = getCompletedStatus(statuses);
            const isCompleted = subtask.status_id === completedStatus?.id;

            return (
              <div
                key={subtask.id}
                className="grid grid-cols-12 gap-4 p-3 hover:workspace-hover border-b workspace-border last:border-b-0 cursor-pointer"
                onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                  if (
                    e.target instanceof HTMLElement &&
                    e.target.closest("button")
                  )
                    return;
                  window.location.href = `/${workspace.workspace_id}/task/${subtask.task_id}`;
                }}
              >
                <div className="col-span-4 flex items-center space-x-2">
                  <button
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      onToggleSubtaskComplete(subtask);
                    }}
                    className="flex-shrink-0"
                  >
                    {isCompleted ? (
                      <CheckSquare className="h-4 w-4 text-green-600" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                  <span
                    className={`text-sm ${isCompleted ? "line-through" : ""}`}
                  >
                    {subtask.name}
                  </span>
                </div>
                <div className="col-span-3 flex items-center">
                  {subtask.assignee ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 p-1 workspace-sidebar-text hover:workspace-hover"
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => e.stopPropagation()}
                        >
                          <Avatar className="h-4 w-4 mr-1">
                            <AvatarImage
                              src={subtask.assignee.avatar_url ?? undefined}
                              alt={subtask.assignee.full_name || "User"}
                            />
                            <AvatarFallback className="text-xs workspace-component-bg workspace-component-active-color">
                              {getAvatarInitials(
                                subtask.assignee.full_name,
                                subtask.assignee.email
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs truncate max-w-[80px]">
                            {subtask.assignee.full_name}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
                        <Command>
                          <CommandInput placeholder="Search user..." />
                          <CommandList>
                            <CommandEmpty>No users found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                onSelect={() =>
                                  onUpdateSubtaskAssignee(subtask.id, null)
                                }
                                className="flex items-center justify-between text-red-600"
                              >
                                <span>Remove assignee</span>
                              </CommandItem>
                              {workspaceMembers
                                .filter(
                                  (member: Profile) => member.id !== subtask.assignee_id
                                )
                                .map((member: Profile) => (
                                  <CommandItem
                                    key={member.id}
                                    onSelect={() =>
                                      onUpdateSubtaskAssignee(
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
                                      <span>{member.full_name}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 p-1 workspace-sidebar-text hover:workspace-hover"
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => e.stopPropagation()}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0">
                        <Command>
                          <CommandInput placeholder="Search user..." />
                          <CommandList>
                            <CommandEmpty>No users found.</CommandEmpty>
                            <CommandGroup>
                              {workspaceMembers.map((member: Profile) => (
                                <CommandItem
                                  key={member.id}
                                  onSelect={() =>
                                    onUpdateSubtaskAssignee(
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
                                    <span>{member.full_name}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <div className="col-span-2 flex items-center">
                  <Select
                    value={subtask.priority || "none"}
                    onValueChange={(value: string) =>
                      onUpdateSubtaskPriority(
                        subtask.id,
                        value === "none" ? "" : value
                      )
                    }
                  >
                    <SelectTrigger
                      className="h-6 text-xs workspace-header-bg border border-transparent hover:workspace-hover"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => e.stopPropagation()}
                    >
                      <SelectValue>
                        {subtask.priority ? (
                          <div className="flex items-center gap-1">
                            <Goal
                              className={`w-3 h-3 ${
                                priorityConfig[
                                  subtask.priority as keyof typeof priorityConfig
                                ]?.color
                              }`}
                            />
                            <span className="text-xs">
                              {
                                priorityConfig[
                                  subtask.priority as keyof typeof priorityConfig
                                ]?.label
                              }
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">
                            Priority
                          </span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="workspace-header-bg">
                      <SelectItem
                        value="none"
                        className="hover:workspace-hover cursor-pointer"
                      >
                        <span className="text-xs text-gray-500">
                          No priority
                        </span>
                      </SelectItem>
                      {Object.entries(priorityConfig).map(([key, config]: [string, { label: string; color: string; bgColor: string }]) => (
                        <SelectItem
                          key={key}
                          value={key}
                          className="hover:workspace-hover cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Goal className={`w-3 h-3 ${config.color}`} />
                            <span className="text-xs">{config.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex items-center">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-6 p-1 text-xs workspace-sidebar-text hover:workspace-hover"
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => e.stopPropagation()}
                      >
                        <CalendarIcon className="h-3 w-3 text-gray-400 mr-1" />
                        <span>
                          {subtask.due_date
                            ? format(parseISO(subtask.due_date), "MMM d")
                            : "Due date"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={
                          subtask.due_date
                            ? parseISO(subtask.due_date)
                            : undefined
                        }
                        onSelect={(date: Date | undefined) =>
                          onUpdateSubtaskDueDate(subtask.id, date)
                        }
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      onSetDeleteDialogOpen(subtask.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Add Subtask Row */}
          {isAddingSubtask && (
            <div className="grid grid-cols-12 gap-4 p-3 border-b workspace-border">
              <div className="col-span-4 flex items-center space-x-2">
                <Square className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <Input
                  value={newSubtaskName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onNewSubtaskNameChange(e.target.value)}
                  placeholder="Subtask name"
                  className="border-none p-0 focus:ring-0 bg-transparent"
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter") {
                      onHandleAddSubtask();
                    } else if (e.key === "Escape") {
                      onToggleAddSubtask(false);
                      onNewSubtaskNameChange("");
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="col-span-8 flex items-center justify-end space-x-2">
                <Button
                  size="sm"
                  onClick={onHandleAddSubtask}
                  disabled={loading}
                >
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onToggleAddSubtask(false);
                    onNewSubtaskNameChange("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {subtasks.length === 0 && !isAddingSubtask && (
            <div className="p-8 text-center workspace-sidebar-text">
              <GitBranch className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mb-4">
                No subtasks yet. Break down this task into smaller pieces.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onAddSubtask}
                className="h-9"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add first subtask
              </Button>
            </div>
          )}
        </div>
        </div>
      )}

      {/* Delete Subtask Dialog */}
      <Dialog
        open={!!deleteDialogOpen}
        onOpenChange={(open: boolean) => !open && onSetDeleteDialogOpen(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Subtask</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "
              {deleteDialogOpen
                ? subtasks.find((st: Task) => st.id === deleteDialogOpen)?.name
                : ""}
              "? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => onSetDeleteDialogOpen(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteDialogOpen) {
                  onDeleteSubtask(deleteDialogOpen);
                  onSetDeleteDialogOpen(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
