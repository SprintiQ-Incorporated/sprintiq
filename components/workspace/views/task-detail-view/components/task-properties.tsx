"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CalendarIcon,
  Plus,
  Flag,
  CircleDot,
  Users,
  Clock,
  Tag,
  Goal,
  Layers,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { getAvatarInitials, cn } from "@/lib/utils";
import { priorityConfig } from "../../project/types";
import { getStatusColor, tagColorClasses, colorMap } from "../utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { TaskPropertiesProps } from "../types";

export function TaskProperties({
  task,
  statuses,
  tags,
  workspaceMembers,
  teamMembers,
  taskAssignees,
  workspace: _workspace,
  project,
  sprint,
  space,
  loading,
  onUpdateStatus,
  onUpdatePriority,
  onUpdateStartDate,
  onUpdateDueDate,
  onUpdateTimeEstimate,
  onUpdateStoryPoints,
  onAddAssignee,
  onRemoveAssignee,
  onAddTag,
  onRemoveTag,
  onCreateAndAssignTag,
}: TaskPropertiesProps) {
  const isMobile = useIsMobile();
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [tagSearchValue, setTagSearchValue] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [storyPointsInput, setStoryPointsInput] = useState(task.story_points?.toString() || "");
  const [timeEstimateInput, setTimeEstimateInput] = useState(task.estimated_time?.toString() || "");
  const [planningOpen, setPlanningOpen] = useState(!isMobile);

  // Update local input values when task changes
  useEffect(() => {
    setStoryPointsInput(task.story_points?.toString() || "");
    setTimeEstimateInput(task.estimated_time?.toString() || "");
  }, [task.story_points, task.estimated_time]);

  const handleStartDateChange = async (date: Date | undefined) => {
    await onUpdateStartDate(date);
    setStartDateOpen(false);
  };

  const handleDueDateChange = async (date: Date | undefined) => {
    await onUpdateDueDate(date);
    setDueDateOpen(false);
  };

  const handleCreateTag = async (tagName: string) => {
    if (isCreatingTag) return; // Prevent multiple calls

    const trimmedName = tagName.trim();
    if (!trimmedName) return;

    // Check for existing tag (case-insensitive)
    const existingTag = tags.find(
      (tag) => tag.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingTag) {
      // Tag already exists, just add it
      await onAddTag(existingTag.id);
      setTagSearchValue("");
      return;
    }

    // Create new tag
    setIsCreatingTag(true);
    try {
      await onCreateAndAssignTag(trimmedName);
      setTagSearchValue("");
    } catch (error) {
      console.error("Error creating tag:", error);
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagSearchValue.trim() && !isCreatingTag) {
      e.preventDefault();
      handleCreateTag(tagSearchValue);
    }
  };

  const handleStoryPointsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const numValue = storyPointsInput === "" ? null : parseFloat(storyPointsInput);
      onUpdateStoryPoints(numValue);
    }
  };

  const handleTimeEstimateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const numValue = timeEstimateInput === "" ? null : parseFloat(timeEstimateInput);
      onUpdateTimeEstimate(numValue);
    }
  };

  // Filter statuses for current context
  const filteredStatuses = statuses.filter(
    (status) =>
      (status.type === "project" && project && status.project_id === project.id) ||
      (status.type === "space" && status.space_id === space.id) ||
      (status.type === "sprint" && sprint && status.sprint_id === sprint.id)
  );

  // Reusable Assignee Picker
  const AssigneePickerContent = () => (
    <Command>
      <CommandInput placeholder="Search members..." />
      <CommandList>
        <CommandEmpty>No members found.</CommandEmpty>
        <CommandGroup>
          {workspaceMembers.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Workspace Members
              </div>
              {workspaceMembers
                .filter(
                  (member) =>
                    !taskAssignees.some((assignee) => assignee.id === member.id)
                )
                .map((member) => (
                  <CommandItem
                    key={`profile-${member.id}`}
                    onSelect={() => onAddAssignee(member.id)}
                    className="flex items-center gap-2 min-h-[44px]"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {getAvatarInitials(member.full_name, member.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{member.full_name}</span>
                  </CommandItem>
                ))}
            </>
          )}
          {teamMembers && teamMembers.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Team Members
              </div>
              {teamMembers.map((member: any) => (
                <CommandItem
                  key={`team-${member.id}`}
                  onSelect={() => onAddAssignee(`team-${member.id}`)}
                  className="flex items-center gap-2 min-h-[44px]"
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
            </>
          )}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  return (
    <div className={cn(
      "workspace-header-bg border-r workspace-border overflow-y-auto",
      isMobile ? "hidden" : "w-72 p-3"
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-md flex items-center justify-center shadow-sm">
          <CircleDot className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold workspace-sidebar-text">
          Details
        </span>
      </div>

      {/* Summary Card - Status, Priority, Dates, Assignees */}
      <Card className="group p-3 mb-4 workspace-header-bg border workspace-border hover:border-emerald-300/50 dark:hover:border-emerald-600/50 transition-all duration-300 hover:shadow-md relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/10 dark:to-teal-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <div className="relative space-y-3">
          {/* Status Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-[80px]">
              <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded flex items-center justify-center shadow-sm">
                <CircleDot className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-medium workspace-sidebar-text">Status</span>
            </div>
            <Select
              value={task.status_id}
              onValueChange={onUpdateStatus}
              disabled={loading}
            >
              <SelectTrigger className="h-8 w-[140px] workspace-header-bg border border-transparent hover:workspace-hover text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="workspace-header-bg">
                {filteredStatuses.map((status) => (
                  <SelectItem
                    key={status.id}
                    value={status.id}
                    className="hover:workspace-hover cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <div className={cn("w-2 h-2 rounded-full", getStatusColor(status))} />
                      <span className="truncate">{status.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-[80px]">
              <div className="w-5 h-5 bg-gradient-to-br from-amber-500 to-orange-600 rounded flex items-center justify-center shadow-sm">
                <Goal className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-medium workspace-sidebar-text">Priority</span>
            </div>
            <Select
              value={task.priority || "none"}
              onValueChange={(value) => onUpdatePriority(value === "none" ? "" : value)}
              disabled={loading}
            >
              <SelectTrigger className="h-8 w-[140px] workspace-header-bg border border-transparent hover:workspace-hover text-xs">
                <SelectValue>
                  {task.priority ? (
                    <div className="flex items-center gap-2">
                      <Goal className={cn("w-3 h-3", priorityConfig[task.priority as keyof typeof priorityConfig]?.color)} />
                      <span>{priorityConfig[task.priority as keyof typeof priorityConfig]?.label}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">+ Set priority</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="workspace-header-bg">
                <SelectItem value="none" className="hover:workspace-hover cursor-pointer">
                  <span className="text-xs text-muted-foreground">No priority</span>
                </SelectItem>
                {Object.entries(priorityConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key} className="hover:workspace-hover cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Goal className={cn("w-3 h-3", config.color)} />
                      <span className="text-xs">{config.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignees Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-[80px]">
              <div className="w-5 h-5 bg-gradient-to-br from-purple-500 to-violet-600 rounded flex items-center justify-center shadow-sm">
                <Users className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-medium workspace-sidebar-text">Assignee</span>
            </div>
            <div className="flex items-center gap-1">
              {taskAssignees.length > 0 ? (
                <>
                  {taskAssignees.map((assignee) => (
                    <div key={assignee.id} className="relative group">
                      <Avatar className="h-7 w-7">
                        <AvatarImage
                          src={
                            assignee.type === "team"
                              ? assignee.profile?.avatar_url
                              : assignee.avatar_url ?? undefined
                          }
                        />
                        <AvatarFallback className="text-xs workspace-component-bg workspace-component-active-color">
                          {getAvatarInitials(
                            assignee.type === "team"
                              ? assignee.profile?.full_name || assignee.name
                              : assignee.full_name,
                            assignee.type === "team"
                              ? assignee.profile?.email || assignee.email
                              : assignee.email
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        onClick={() => onRemoveAssignee(assignee.id)}
                        className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 rounded-full border border-dashed workspace-border hover:workspace-hover"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[220px] p-0">
                      <AssigneePickerContent />
                    </PopoverContent>
                  </Popover>
                </>
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-muted-foreground hover:workspace-hover"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Assign
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[220px] p-0">
                    <AssigneePickerContent />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          {/* Due Date Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-[80px]">
              <div className="w-5 h-5 bg-gradient-to-br from-rose-500 to-pink-600 rounded flex items-center justify-center shadow-sm">
                <CalendarIcon className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-medium workspace-sidebar-text">Due Date</span>
            </div>
            <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "h-8 px-2 text-xs hover:workspace-hover",
                    task.due_date ? "workspace-sidebar-text" : "text-muted-foreground"
                  )}
                >
                  {task.due_date ? format(parseISO(task.due_date), "MMM d, yyyy") : "+ Set due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={task.due_date ? parseISO(task.due_date) : undefined}
                  onSelect={handleDueDateChange}
                  disabled={loading}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </Card>

      {/* Planning Card - Dates, Estimate, Story Points */}
      <Collapsible open={planningOpen} onOpenChange={setPlanningOpen}>
        <Card className="group mb-4 workspace-header-bg border workspace-border overflow-hidden hover:border-indigo-300/50 dark:hover:border-indigo-600/50 transition-all duration-300 hover:shadow-md relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/10 dark:to-purple-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          <CollapsibleTrigger className="relative w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center shadow-sm">
                <Layers className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-medium workspace-sidebar-text uppercase tracking-wide">
                Planning
              </span>
            </div>
            {planningOpen ? (
              <ChevronDown className="h-4 w-4 workspace-sidebar-text" />
            ) : (
              <ChevronRight className="h-4 w-4 workspace-sidebar-text" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="relative p-3 pt-0 space-y-3">
              {/* Start Date */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-[80px]">
                  <div className="w-5 h-5 bg-gradient-to-br from-teal-500 to-cyan-600 rounded flex items-center justify-center shadow-sm">
                    <CalendarIcon className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-xs font-medium workspace-sidebar-text">Start</span>
                </div>
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "h-8 px-2 text-xs hover:workspace-hover",
                        task.start_date ? "workspace-sidebar-text" : "text-muted-foreground"
                      )}
                    >
                      {task.start_date ? format(parseISO(task.start_date), "MMM d, yyyy") : "+ Set start"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={task.start_date ? parseISO(task.start_date) : undefined}
                      onSelect={handleStartDateChange}
                      disabled={loading}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time Estimate */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-[80px]">
                  <div className="w-5 h-5 bg-gradient-to-br from-sky-500 to-blue-600 rounded flex items-center justify-center shadow-sm">
                    <Clock className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-xs font-medium workspace-sidebar-text">Estimate</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={timeEstimateInput}
                  onChange={(e) => setTimeEstimateInput(e.target.value)}
                  onBlur={() => {
                    const numValue = timeEstimateInput === "" ? null : parseFloat(timeEstimateInput);
                    onUpdateTimeEstimate(numValue);
                  }}
                  onKeyDown={handleTimeEstimateKeyDown}
                  disabled={loading}
                  placeholder="+ Hours"
                  className="w-[100px] h-8 px-2 text-xs text-right workspace-header-bg border border-transparent hover:workspace-hover focus:outline-none focus:ring-1 focus:ring-ring rounded placeholder:text-muted-foreground"
                />
              </div>

              {/* Story Points */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-[80px]">
                  <div className="w-5 h-5 bg-gradient-to-br from-green-500 to-emerald-600 rounded flex items-center justify-center shadow-sm">
                    <Flag className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-xs font-medium workspace-sidebar-text">Points</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={storyPointsInput}
                  onChange={(e) => setStoryPointsInput(e.target.value)}
                  onBlur={() => {
                    const numValue = storyPointsInput === "" ? null : parseFloat(storyPointsInput);
                    onUpdateStoryPoints(numValue);
                  }}
                  onKeyDown={handleStoryPointsKeyDown}
                  disabled={loading}
                  placeholder="+ Points"
                  className="w-[100px] h-8 px-2 text-xs text-right workspace-header-bg border border-transparent hover:workspace-hover focus:outline-none focus:ring-1 focus:ring-ring rounded placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Tags Card */}
      <Card className="group p-3 workspace-header-bg border workspace-border hover:border-pink-300/50 dark:hover:border-pink-600/50 transition-all duration-300 hover:shadow-md relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-50/50 to-rose-50/50 dark:from-pink-900/10 dark:to-rose-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <div className="relative flex items-center gap-2 mb-3">
          <div className="w-5 h-5 bg-gradient-to-br from-pink-500 to-rose-600 rounded flex items-center justify-center shadow-sm">
            <Tag className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-medium workspace-sidebar-text uppercase tracking-wide">
            Tags
          </span>
        </div>

        <div className="relative space-y-2">
          {task.task_tags && task.task_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {task.task_tags.map((taskTag: any) => (
                <span
                  key={taskTag.tag.id}
                  className={cn(
                    "inline-flex items-center px-2 py-1 rounded-md text-xs font-medium group relative",
                    tagColorClasses[taskTag.tag.color]
                  )}
                >
                  {taskTag.tag.name}
                  <button
                    onClick={() => onRemoveTag(taskTag.tag.id)}
                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground hover:workspace-hover"
              >
                <Plus className="h-3 w-3 mr-1" />
                {task.task_tags && task.task_tags.length > 0 ? "Add tag" : "Add tags"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0">
              <Command>
                <CommandInput
                  placeholder="Search or create..."
                  value={tagSearchValue}
                  onValueChange={setTagSearchValue}
                  onKeyDown={handleTagKeyDown}
                />
                <CommandList>
                  <CommandEmpty>
                    {tagSearchValue.trim() ? (
                      <div className="p-2 text-center">
                        <div className="text-sm text-muted-foreground mb-1">
                          {isCreatingTag ? "Creating..." : "No tags found"}
                        </div>
                        {!isCreatingTag && (
                          <div className="text-xs text-primary">
                            Press Enter to create &quot;{tagSearchValue.trim()}&quot;
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-2 text-center text-sm text-muted-foreground">
                        No tags found
                      </div>
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {tags
                      .filter(
                        (tag) =>
                          !task.task_tags?.some((taskTag: any) => taskTag.tag.id === tag.id) &&
                          tag.name.toLowerCase().includes(tagSearchValue.toLowerCase())
                      )
                      .map((tag) => (
                        <CommandItem
                          key={tag.id}
                          onSelect={() => {
                            onAddTag(tag.id);
                            setTagSearchValue("");
                          }}
                          className="flex items-center gap-2 min-h-[36px]"
                        >
                          <div className={cn("w-2 h-2 rounded-full", tag.color ? colorMap[tag.color] : "bg-gray-500")} />
                          <span>{tag.name}</span>
                        </CommandItem>
                      ))}
                    {tagSearchValue.trim() &&
                      !isCreatingTag &&
                      !tags.some(
                        (tag) => tag.name.toLowerCase() === tagSearchValue.trim().toLowerCase()
                      ) && (
                        <CommandItem
                          onSelect={() => handleCreateTag(tagSearchValue.trim())}
                          className="flex items-center gap-2 text-primary min-h-[36px]"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Create &quot;{tagSearchValue.trim()}&quot;</span>
                        </CommandItem>
                      )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </Card>
    </div>
  );
}
