"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Filter,
  X,
  Users,
  Tag,
  Target,
  ChevronDown,
  Goal,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatusColor } from "../views/sprint/utils";

interface Status {
  id: string;
  name: string;
}

interface Tag {
  id: string;
  name: string;
}

interface WorkspaceMember {
  id: string;
  full_name: string;
}

interface TeamMember {
  id: string;
  name?: string;
  profile?: {
    full_name?: string;
  };
}

interface FilterValues {
  status: string[];
  tags: string[];
  priority: string[];
  assigned: string[];
  sprintPoints: { min: number; max: number };
  showUnassignedOnly: boolean;
}

interface FilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  statuses: Status[];
  tags: Tag[];
  workspaceMembers: WorkspaceMember[];
  teamMembers?: TeamMember[];
}

const priorityOptions = [
  { value: "critical", label: "Critical", color: "text-red-600" },
  { value: "high", label: "High", color: "text-yellow-600" },
  { value: "medium", label: "Medium", color: "text-blue-600" },
  { value: "low", label: "Low", color: "text-green-600" },
];

export default function FilterModal({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  statuses,
  tags,
  workspaceMembers,
  teamMembers,
}: FilterModalProps) {
  const [openPopovers, setOpenPopovers] = useState({
    status: false,
    tags: false,
    priority: false,
    assigned: false,
  });

  const handleClearFilters = () => {
    onFiltersChange({
      status: [],
      tags: [],
      priority: [],
      assigned: [],
      sprintPoints: { min: 0, max: 100 },
      showUnassignedOnly: false,
    });
  };

  const getActiveFiltersCount = () => {
    return (
      filters.status.length +
      filters.tags.length +
      filters.priority.length +
      filters.assigned.length +
      (filters.sprintPoints.min > 0 || filters.sprintPoints.max < 100 ? 1 : 0)
    );
  };

  const removeFilter = (type: string, value: string) => {
    if (type === "status") {
      onFiltersChange({
        ...filters,
        status: filters.status.filter((v: string) => v !== value),
      });
    } else if (type === "tags") {
      onFiltersChange({
        ...filters,
        tags: filters.tags.filter((v: string) => v !== value),
      });
    } else if (type === "priority") {
      onFiltersChange({
        ...filters,
        priority: filters.priority.filter((v: string) => v !== value),
      });
    } else if (type === "assigned") {
      onFiltersChange({
        ...filters,
        assigned: filters.assigned.filter((v: string) => v !== value),
      });
    }
  };

  const removeSprintPointsFilter = () => {
    onFiltersChange({
      ...filters,
      sprintPoints: { min: 0, max: 100 },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Tasks
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary" className="ml-2">
                {getActiveFiltersCount()}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure filters to narrow down tasks by status, priority, assigned members, tags, and sprint points
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Active Filters Display */}
          {getActiveFiltersCount() > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Active Filters</Label>
              <div className="flex flex-wrap gap-2">
                {filters.status.map((statusId: string) => {
                  const status = statuses.find((s: Status) => s.id === statusId);
                  return (
                    <Badge
                      key={`status-${statusId}`}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <span className="w-2 h-2 bg-blue-500 rounded-full" />
                      {status?.name || statusId}
                      <button
                        onClick={() => removeFilter("status", statusId)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
                {filters.tags.map((tagId: string) => {
                  const tag = tags.find((t: Tag) => t.id === tagId);
                  return (
                    <Badge
                      key={`tag-${tagId}`}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <Tag className="h-3 w-3" />
                      {tag?.name || tagId}
                      <button
                        onClick={() => removeFilter("tags", tagId)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
                {filters.priority.map((priority: string) => {
                  const priorityOption = priorityOptions.find(
                    (p: { value: string; label: string; color: string }) => p.value === priority
                  );
                  return (
                    <Badge
                      key={`priority-${priority}`}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <Goal className="h-3 w-3" />
                      {priorityOption?.label || priority}
                      <button
                        onClick={() => removeFilter("priority", priority)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
                {filters.assigned.map((userId: string) => {
                  const member = workspaceMembers.find((m: WorkspaceMember) => m.id === userId);
                  return (
                    <Badge
                      key={`assigned-${userId}`}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <Users className="h-3 w-3" />
                      {member?.full_name || userId}
                      <button
                        onClick={() => removeFilter("assigned", userId)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
                {(filters.sprintPoints.min > 0 ||
                  filters.sprintPoints.max < 100) && (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <Target className="h-3 w-3" />
                    {filters.sprintPoints.min}-{filters.sprintPoints.max} pts
                    <button
                      onClick={removeSprintPointsFilter}
                      className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Status Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <CircleDot className="h-4 w-4" />
              Status
            </Label>
            <Popover
              open={openPopovers.status}
              onOpenChange={(open: boolean) =>
                setOpenPopovers((prev) => ({ ...prev, status: open }))
              }
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {filters.status.length > 0
                    ? `${filters.status.length} selected`
                    : "Select statuses..."}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[550px] p-0">
                <Command>
                  <CommandInput placeholder="Search statuses..." />
                  <CommandList>
                    <CommandEmpty>No status found.</CommandEmpty>
                    <CommandGroup>
                      {statuses.map((status: Status) => (
                        <CommandItem
                          key={status.id}
                          onSelect={() => {
                            const isSelected = filters.status.includes(
                              status.id
                            );
                            onFiltersChange({
                              ...filters,
                              status: isSelected
                                ? filters.status.filter(
                                    (id: string) => id !== status.id
                                  )
                                : [...filters.status, status.id],
                            });
                          }}
                        >
                          <Checkbox
                            checked={filters.status.includes(status.id)}
                            className="mr-2"
                            variant="workspace"
                          />
                          <span
                            className={`w-2 h-2 ${getStatusColor(
                              status as any
                            )} rounded-full mr-2`}
                          />
                          {status.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Tags Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tags
            </Label>
            <Popover
              open={openPopovers.tags}
              onOpenChange={(open: boolean) =>
                setOpenPopovers((prev) => ({ ...prev, tags: open }))
              }
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {filters.tags.length > 0
                    ? `${filters.tags.length} selected`
                    : "Select tags..."}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[550px] p-0">
                <Command>
                  <CommandInput placeholder="Search tags..." />
                  <CommandList>
                    <CommandEmpty>No tag found.</CommandEmpty>
                    <CommandGroup>
                      {tags.map((tag: Tag) => (
                        <CommandItem
                          key={tag.id}
                          onSelect={() => {
                            const isSelected = filters.tags.includes(tag.id);
                            onFiltersChange({
                              ...filters,
                              tags: isSelected
                                ? filters.tags.filter((id: string) => id !== tag.id)
                                : [...filters.tags, tag.id],
                            });
                          }}
                        >
                          <Checkbox
                            checked={filters.tags.includes(tag.id)}
                            className="mr-2"
                            variant="workspace"
                          />
                          <Tag className="h-4 w-4 mr-2" />
                          {tag.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Priority Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Goal className="h-4 w-4" />
              Priority
            </Label>
            <Popover
              open={openPopovers.priority}
              onOpenChange={(open: boolean) =>
                setOpenPopovers((prev) => ({ ...prev, priority: open }))
              }
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {filters.priority.length > 0
                    ? `${filters.priority.length} selected`
                    : "Select priorities..."}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[550px] p-0">
                <Command>
                  <CommandInput placeholder="Search priorities..." />
                  <CommandList>
                    <CommandEmpty>No priority found.</CommandEmpty>
                    <CommandGroup>
                      {priorityOptions.map((priority: { value: string; label: string; color: string }) => (
                        <CommandItem
                          key={priority.value}
                          onSelect={() => {
                            const isSelected = filters.priority.includes(
                              priority.value
                            );
                            onFiltersChange({
                              ...filters,
                              priority: isSelected
                                ? filters.priority.filter(
                                    (p: string) => p !== priority.value
                                  )
                                : [...filters.priority, priority.value],
                            });
                          }}
                        >
                          <Checkbox
                            checked={filters.priority.includes(priority.value)}
                            className="mr-2"
                            variant="workspace"
                          />
                          <Goal
                            className={cn("h-4 w-4 mr-2", priority.color)}
                          />
                          {priority.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Assigned Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Assigned To
            </Label>
            <Popover
              open={openPopovers.assigned}
              onOpenChange={(open: boolean) =>
                setOpenPopovers((prev) => ({ ...prev, assigned: open }))
              }
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {filters.assigned.length > 0
                    ? `${filters.assigned.length} selected`
                    : "Select assignees..."}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[550px] p-0">
                <Command>
                  <CommandInput placeholder="Search users..." />
                  <CommandList>
                    <CommandEmpty>No user found.</CommandEmpty>
                    <CommandGroup>
                      {/* Workspace Members */}
                      {workspaceMembers.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                            Workspace Members
                          </div>
                          {workspaceMembers.map((member: WorkspaceMember) => (
                            <CommandItem
                              key={member.id}
                              onSelect={() => {
                                const isSelected = filters.assigned.includes(
                                  member.id
                                );
                                onFiltersChange({
                                  ...filters,
                                  assigned: isSelected
                                    ? filters.assigned.filter(
                                        (id: string) => id !== member.id
                                      )
                                    : [...filters.assigned, member.id],
                                });
                              }}
                            >
                              <Checkbox
                                checked={filters.assigned.includes(member.id)}
                                className="mr-2"
                                variant="workspace"
                              />
                              <Users className="h-4 w-4 mr-2" />
                              {member.full_name}
                            </CommandItem>
                          ))}
                        </>
                      )}

                      {/* Team Members */}
                      {teamMembers && teamMembers.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                            Team Members
                          </div>
                          {teamMembers.map((member: TeamMember) => (
                            <CommandItem
                              key={`team-${member.id}`}
                              onSelect={() => {
                                const teamMemberId = `team-${member.id}`;
                                const isSelected = filters.assigned.includes(
                                  teamMemberId
                                );
                                onFiltersChange({
                                  ...filters,
                                  assigned: isSelected
                                    ? filters.assigned.filter(
                                        (id: string) => id !== teamMemberId
                                      )
                                    : [...filters.assigned, teamMemberId],
                                });
                              }}
                            >
                              <Checkbox
                                checked={filters.assigned.includes(`team-${member.id}`)}
                                className="mr-2"
                                variant="workspace"
                              />
                              <Users className="h-4 w-4 mr-2" />
                              {member.profile?.full_name || member.name}
                            </CommandItem>
                          ))}
                        </>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Sprint Points Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Sprint Points Range
            </Label>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Min</Label>
                <Input
                  type="number"
                  value={filters.sprintPoints.min}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onFiltersChange({
                      ...filters,
                      sprintPoints: {
                        ...filters.sprintPoints,
                        min: Number(e.target.value) || 0,
                      },
                    })
                  }
                  min={0}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Max</Label>
                <Input
                  type="number"
                  value={filters.sprintPoints.max}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onFiltersChange({
                      ...filters,
                      sprintPoints: {
                        ...filters.sprintPoints,
                        max: Number(e.target.value) || 100,
                      },
                    })
                  }
                  min={0}
                  placeholder="100"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleClearFilters}>
            Clear All Filters
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="workspace">
              Apply Filters
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
