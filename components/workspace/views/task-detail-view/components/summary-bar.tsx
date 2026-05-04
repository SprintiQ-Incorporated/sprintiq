"use client";

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";


import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  CalendarIcon,
  Goal,
  Users,
  ChevronDown,
  Plus,
  Pencil,
  Share2,
  Terminal,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { getAvatarInitials, cn } from "@/lib/utils";
import { priorityConfig } from "../../project/types";
import { getStatusColor } from "../utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Task, Status, Profile } from "@/lib/database-aliases";

interface SummaryBarProps {
  task: Task;
  statuses: Status[];
  taskAssignees: any[];
  workspaceMembers: Profile[];
  teamMembers: any[];
  loading: boolean;
  onUpdateStatus: (statusId: string) => void;
  onUpdatePriority: (priority: string) => void;
  onUpdateDueDate: (date: Date | undefined) => void;
  onAddAssignee: (memberId: string) => void;
  onRemoveAssignee: (memberId: string) => void;
  onEditTaskName: () => void;
  onAddSubtask: () => void;
  onShare: () => void;
  onCodeWithClaude?: () => void;
  claudeSessionActive?: boolean;
}

// Priority badge colors
const priorityBadgeColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

export function SummaryBar({
  task,
  statuses,
  taskAssignees,
  workspaceMembers,
  teamMembers,
  loading,
  onUpdateStatus,
  onUpdatePriority,
  onUpdateDueDate,
  onAddAssignee,
  onRemoveAssignee,
  onEditTaskName,
  onAddSubtask,
  onShare,
  onCodeWithClaude,
  claudeSessionActive,
}: SummaryBarProps) {
  const isMobile = useIsMobile();
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);

  const currentStatus = statuses.find((s) => s.id === task.status_id);
  const currentPriority = task.priority as keyof typeof priorityConfig;

  const handleDueDateChange = (date: Date | undefined) => {
    onUpdateDueDate(date);
    setDueDateOpen(false);
  };

  // Status Pill Component
  const StatusPill = () => {
    if (isMobile) {
      return (
        <>
          <button
            onClick={() => setStatusOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-muted hover:bg-muted/80 transition-colors min-h-[32px]"
            disabled={loading}
          >
            <div className={cn("w-2 h-2 rounded-full", currentStatus ? getStatusColor(currentStatus) : "bg-gray-400")} />
            <span className="truncate max-w-[80px]">{currentStatus?.name || "Status"}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          <Drawer open={statusOpen} onOpenChange={setStatusOpen}>
            <DrawerContent className="workspace-header-bg">
              <DrawerHeader>
                <DrawerTitle>Select Status</DrawerTitle>
              </DrawerHeader>
              <div className="p-4 space-y-2">
                {statuses.map((status) => (
                  <button
                    key={status.id}
                    onClick={() => {
                      onUpdateStatus(status.id);
                      setStatusOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                      status.id === task.status_id
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className={cn("w-3 h-3 rounded-full", getStatusColor(status))} />
                    <span className="font-medium">{status.name}</span>
                  </button>
                ))}
              </div>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </>
      );
    }

    return (
      <Popover open={statusOpen} onOpenChange={setStatusOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            disabled={loading}
          >
            <div className={cn("w-2 h-2 rounded-full", currentStatus ? getStatusColor(currentStatus) : "bg-gray-400")} />
            <span>{currentStatus?.name || "Status"}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="start">
          {statuses.map((status) => (
            <button
              key={status.id}
              onClick={() => {
                onUpdateStatus(status.id);
                setStatusOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors",
                status.id === task.status_id ? "bg-muted" : "hover:bg-muted"
              )}
            >
              <div className={cn("w-2 h-2 rounded-full", getStatusColor(status))} />
              <span>{status.name}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    );
  };

  // Priority Pill Component
  const PriorityPill = () => {
    const priorityLabel = currentPriority
      ? priorityConfig[currentPriority]?.label
      : null;
    const priorityColor = currentPriority
      ? priorityBadgeColors[currentPriority]
      : "bg-muted text-muted-foreground";

    if (isMobile) {
      return (
        <>
          <button
            onClick={() => setPriorityOpen(true)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors min-h-[32px]",
              priorityColor
            )}
            disabled={loading}
          >
            <Goal className="w-3 h-3" />
            <span className="truncate max-w-[60px]">{priorityLabel || "Priority"}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          <Drawer open={priorityOpen} onOpenChange={setPriorityOpen}>
            <DrawerContent className="workspace-header-bg">
              <DrawerHeader>
                <DrawerTitle>Select Priority</DrawerTitle>
              </DrawerHeader>
              <div className="p-4 space-y-2">
                <button
                  onClick={() => {
                    onUpdatePriority("");
                    setPriorityOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                    !task.priority ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
                  )}
                >
                  <Goal className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-muted-foreground">No priority</span>
                </button>
                {Object.entries(priorityConfig).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => {
                      onUpdatePriority(key);
                      setPriorityOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                      task.priority === key
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted"
                    )}
                  >
                    <Goal className={cn("w-4 h-4", config.color)} />
                    <span className="font-medium">{config.label}</span>
                  </button>
                ))}
              </div>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </>
      );
    }

    return (
      <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              priorityColor
            )}
            disabled={loading}
          >
            <Goal className="w-3 h-3" />
            <span>{priorityLabel || "Priority"}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-1" align="start">
          <button
            onClick={() => {
              onUpdatePriority("");
              setPriorityOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors",
              !task.priority ? "bg-muted" : "hover:bg-muted"
            )}
          >
            <Goal className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">No priority</span>
          </button>
          {Object.entries(priorityConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={() => {
                onUpdatePriority(key);
                setPriorityOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors",
                task.priority === key ? "bg-muted" : "hover:bg-muted"
              )}
            >
              <Goal className={cn("w-3 h-3", config.color)} />
              <span>{config.label}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
    );
  };

  // Assignee Pill Component
  const AssigneePill = () => {
    const hasAssignee = taskAssignees.length > 0;
    const firstAssignee = taskAssignees[0];

    if (isMobile) {
      return (
        <>
          <button
            onClick={() => setAssigneeOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-muted hover:bg-muted/80 transition-colors min-h-[32px]"
            disabled={loading}
          >
            {hasAssignee ? (
              <>
                <Avatar className="h-5 w-5">
                  <AvatarImage
                    src={
                      firstAssignee.type === "team"
                        ? firstAssignee.profile?.avatar_url
                        : firstAssignee.avatar_url
                    }
                  />
                  <AvatarFallback className="text-[10px]">
                    {getAvatarInitials(
                      firstAssignee.type === "team"
                        ? firstAssignee.profile?.full_name || firstAssignee.name
                        : firstAssignee.full_name,
                      firstAssignee.type === "team"
                        ? firstAssignee.profile?.email
                        : firstAssignee.email
                    )}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate max-w-[60px]">
                  {firstAssignee.type === "team"
                    ? firstAssignee.profile?.full_name || firstAssignee.name
                    : firstAssignee.full_name}
                </span>
              </>
            ) : (
              <>
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">+ Assign</span>
              </>
            )}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
          <Drawer open={assigneeOpen} onOpenChange={setAssigneeOpen}>
            <DrawerContent className="workspace-header-bg">
              <DrawerHeader>
                <DrawerTitle>Select Assignee</DrawerTitle>
              </DrawerHeader>
              <div className="p-4 max-h-[60vh] overflow-y-auto">
                <Command>
                  <CommandInput placeholder="Search members..." />
                  <CommandList>
                    <CommandEmpty>No members found.</CommandEmpty>
                    <CommandGroup heading="Workspace Members">
                      {workspaceMembers.map((member) => (
                        <CommandItem
                          key={member.id}
                          onSelect={() => {
                            onAddAssignee(member.id);
                            setAssigneeOpen(false);
                          }}
                          className="flex items-center gap-3 p-3"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {getAvatarInitials(member.full_name, member.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{member.full_name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    {teamMembers && teamMembers.length > 0 && (
                      <CommandGroup heading="Team Members">
                        {teamMembers.map((member: any) => (
                          <CommandItem
                            key={`team-${member.id}`}
                            onSelect={() => {
                              onAddAssignee(`team-${member.id}`);
                              setAssigneeOpen(false);
                            }}
                            className="flex items-center gap-3 p-3"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.profile?.avatar_url ?? undefined} />
                              <AvatarFallback className="text-xs">
                                {getAvatarInitials(
                                  member.profile?.full_name || member.name,
                                  member.profile?.email || member.email
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">
                              {member.profile?.full_name || member.name}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </div>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </>
      );
    }

    return (
      <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            disabled={loading}
          >
            {hasAssignee ? (
              <>
                <Avatar className="h-5 w-5">
                  <AvatarImage
                    src={
                      firstAssignee.type === "team"
                        ? firstAssignee.profile?.avatar_url
                        : firstAssignee.avatar_url
                    }
                  />
                  <AvatarFallback className="text-[10px]">
                    {getAvatarInitials(
                      firstAssignee.type === "team"
                        ? firstAssignee.profile?.full_name || firstAssignee.name
                        : firstAssignee.full_name,
                      firstAssignee.type === "team"
                        ? firstAssignee.profile?.email
                        : firstAssignee.email
                    )}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[80px] truncate">
                  {firstAssignee.type === "team"
                    ? firstAssignee.profile?.full_name || firstAssignee.name
                    : firstAssignee.full_name}
                </span>
              </>
            ) : (
              <>
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">+ Assign</span>
              </>
            )}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search members..." />
            <CommandList>
              <CommandEmpty>No members found.</CommandEmpty>
              <CommandGroup heading="Workspace Members">
                {workspaceMembers.map((member) => (
                  <CommandItem
                    key={member.id}
                    onSelect={() => {
                      onAddAssignee(member.id);
                      setAssigneeOpen(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {getAvatarInitials(member.full_name, member.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{member.full_name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {teamMembers && teamMembers.length > 0 && (
                <CommandGroup heading="Team Members">
                  {teamMembers.map((member: any) => (
                    <CommandItem
                      key={`team-${member.id}`}
                      onSelect={() => {
                        onAddAssignee(`team-${member.id}`);
                        setAssigneeOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={member.profile?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {getAvatarInitials(
                            member.profile?.full_name || member.name,
                            member.profile?.email || member.email
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">
                        {member.profile?.full_name || member.name}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  // Due Date Pill Component
  const DueDatePill = () => {
    const hasDueDate = !!task.due_date;
    const isOverdue =
      hasDueDate && new Date(task.due_date!) < new Date() && task.status_id !== statuses.find((s) => s.name.toLowerCase() === "done")?.id;

    if (isMobile) {
      return (
        <>
          <button
            onClick={() => setDueDateOpen(true)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors min-h-[32px]",
              isOverdue
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : "bg-muted hover:bg-muted/80"
            )}
            disabled={loading}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>
              {hasDueDate ? format(parseISO(task.due_date!), "MMM d") : "+ Due date"}
            </span>
          </button>
          <Drawer open={dueDateOpen} onOpenChange={setDueDateOpen}>
            <DrawerContent className="workspace-header-bg">
              <DrawerHeader>
                <DrawerTitle>Set Due Date</DrawerTitle>
              </DrawerHeader>
              <div className="p-4 flex justify-center">
                <Calendar
                  mode="single"
                  selected={task.due_date ? parseISO(task.due_date) : undefined}
                  onSelect={handleDueDateChange}
                />
              </div>
              <DrawerFooter>
                {hasDueDate && (
                  <Button
                    variant="outline"
                    className="text-red-600"
                    onClick={() => handleDueDateChange(undefined)}
                  >
                    Remove Due Date
                  </Button>
                )}
                <DrawerClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </>
      );
    }

    return (
      <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              isOverdue
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : hasDueDate
                ? "bg-muted hover:bg-muted/80"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
            disabled={loading}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>
              {hasDueDate ? format(parseISO(task.due_date!), "MMM d") : "+ Due date"}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={task.due_date ? parseISO(task.due_date) : undefined}
            onSelect={handleDueDateChange}
          />
          {hasDueDate && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleDueDateChange(undefined)}
              >
                Remove Due Date
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  // Quick Actions - Desktop
  const QuickActions = () => (
    <div className="hidden md:flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-400 transition-colors"
        onClick={onEditTaskName}
      >
        <Pencil className="w-3.5 h-3.5 mr-1" />
        Edit
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400 transition-colors"
        onClick={onAddSubtask}
      >
        <Plus className="w-3.5 h-3.5 mr-1" />
        Subtask
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/30 dark:hover:text-purple-400 transition-colors"
        onClick={onShare}
      >
        <Share2 className="w-3.5 h-3.5 mr-1" />
        Copy Link
      </Button>
      {onCodeWithClaude && (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 px-2 text-xs transition-colors",
            claudeSessionActive
              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/40"
              : "hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-900/30 dark:hover:text-orange-400"
          )}
          onClick={onCodeWithClaude}
        >
          <Terminal className="w-3.5 h-3.5 mr-1" />
          {claudeSessionActive ? "Session Active" : "Code with Claude"}
        </Button>
      )}
    </div>
  );

  return (
    <div className="sticky top-0 z-20 workspace-header-bg border-b workspace-border bg-gradient-to-r from-transparent via-emerald-50/30 to-transparent dark:via-emerald-900/5">
      {/* Desktop Layout */}
      <div className="hidden md:flex items-center justify-between p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill />
          <PriorityPill />
          <AssigneePill />
          <DueDatePill />
        </div>
        <QuickActions />
      </div>

      {/* Mobile Layout - Two rows */}
      <div className="md:hidden p-2">
        {/* First row - Pills */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <StatusPill />
          <PriorityPill />
          <AssigneePill />
          <DueDatePill />
        </div>
      </div>
    </div>
  );
}
