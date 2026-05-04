import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CalendarIcon,
  CircleUserRound,
  CheckIcon,
  Goal,
} from "lucide-react";
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
import { getAvatarInitials } from "@/lib/utils";
import { priorityConfig } from "../types";
import type { SubtaskCardProps } from "../types";
import { formatDateRange } from "../utils";

export const SubtaskCard: React.FC<SubtaskCardProps> = ({
  subtask,
  workspaceMembers,
  teamMembers,
  onTaskClick,
  onUpdatePriority,
  onUpdateDates,
  onAssignTask,
}) => {
  return (
    <div className="workspace-secondary-sidebar-bg border workspace-border rounded-lg p-3 ml-2 cursor-pointer hover:workspace-hover transition-colors">
      <div className="flex items-start justify-between mb-2">
        <h5
          className="font-medium workspace-sidebar-text text-sm cursor-pointer hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onTaskClick(subtask);
          }}
        >
          {subtask.name}
        </h5>
      </div>

      {subtask.description && (
        <p className="text-xs workspace-sidebar-text mb-3 line-clamp-2">
          {subtask.description}
        </p>
      )}

      <div className="flex items-center space-x-3 text-xs text-gray-500">
        {/* Assignee */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {subtask.assignee ? (
                <Avatar className="h-6 w-6">
                  <AvatarImage
                    src={subtask.assignee?.avatar_url ?? undefined}
                    alt={subtask.assignee?.full_name || "User"}
                  />
                  <AvatarFallback className="text-xs workspace-component-bg workspace-component-active-color">
                    {getAvatarInitials(
                      subtask.assignee?.full_name,
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
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onAssignTask(subtask.id, null)}
                    className="flex items-center justify-between"
                  >
                    <span>Unassign</span>
                    {!subtask.assignee_id && (
                      <CheckIcon className="ml-auto h-4 w-4" />
                    )}
                  </CommandItem>

                  {/* Workspace Members */}
                  {workspaceMembers.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        Workspace Members
                      </div>
                      {workspaceMembers.map((member) => (
                        <CommandItem
                          key={`profile-${member.id}`}
                          onSelect={() => onAssignTask(subtask.id, member.id)}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={member?.avatar_url ?? undefined}
                                alt={
                                  member?.full_name ||
                                  member?.username ||
                                  "User"
                                }
                              />
                              <AvatarFallback className="text-xs">
                                {getAvatarInitials(
                                  member.full_name,
                                  member.email
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs">{member.full_name}</span>
                          </div>
                          {subtask.assignee_id === member.id && (
                            <CheckIcon className="ml-auto h-4 w-4" />
                          )}
                        </CommandItem>
                      ))}
                    </>
                  )}

                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Date picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-auto p-1 flex items-center justify-center text-xs hover:workspace-hover border workspace-border rounded-sm"
            >
              <div className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4 workspace-sidebar-text" />
                <span className="workspace-sidebar-text">
                  {formatDateRange(
                    subtask.start_date || undefined,
                    subtask.due_date || undefined
                  )}
                </span>
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3">
              <div className="space-y-4">
                <DatePicker
                  startDate={subtask.start_date}
                  dueDate={subtask.due_date}
                  onDateChange={(startDate, dueDate) =>
                    onUpdateDates(subtask.id, startDate, dueDate)
                  }
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Priority */}
        {subtask.priority ? (
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
                  <CommandEmpty>No priority found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => onUpdatePriority(subtask.id, null)}
                      className="flex items-center justify-between"
                    >
                      <span>No priority</span>
                      {!subtask.priority && (
                        <CheckIcon className="ml-auto h-4 w-4" />
                      )}
                    </CommandItem>
                    {Object.entries(priorityConfig).map(([key, config]) => (
                      <CommandItem
                        key={key}
                        onSelect={() => onUpdatePriority(subtask.id, key)}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center">
                          <Goal className={`h-4 w-4 mr-2 ${config.color}`} />
                          <span>{config.label}</span>
                        </div>
                        {subtask.priority === key && (
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
            onClick={() => onUpdatePriority(subtask.id, "medium")}
          >
            <Goal className="w-4 h-4 workspace-sidebar-text" />
          </Button>
        )}
      </div>
    </div>
  );
};
