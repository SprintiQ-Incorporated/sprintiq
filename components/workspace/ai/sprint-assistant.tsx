"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { MobileDatePicker } from "@/components/ui/mobile-date-picker";
import { nanoid } from "nanoid";
import { cn } from "@/lib/utils";
import {
  Zap,
  Loader2,
  ChevronUp,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  XCircle,
} from "lucide-react";

import type { UserStory, TeamMember } from "@/types";
import type { EnhancedSprint } from "@/lib/sprint-creation-service";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import { useAuth } from "@/contexts/auth-context";
import { createSprintFromStories } from "@/app/[workspaceId]/actions/sprint-actions";
import { HOURS_PER_STORY_POINT } from "@/lib/constants/statusTypes";

interface SprintAssistantProps {
  stories: UserStory[];
  teamMembers: TeamMember[];
  workspaceId: string;
  initialSelectedStories?: string[];
  onSprintCreated: (sprint: EnhancedSprint) => void;
  onClose: () => void;
  onSaveSprints: (
    sprints: ManualSprint[],
    type: "ai" | "manual"
  ) => void;
}

interface ManualSprint {
  id: string;
  name: string;
  duration: number;
  selectedStories: UserStory[];
  capacity: number;
  utilization: number;
  goal?: string;
  startDate?: string;
  endDate?: string;
}

// Story Selection Card Component
function StorySelectionCard({
  story,
  selected,
  onToggle,
}: {
  story: UserStory;
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "border rounded-lg p-3 cursor-pointer transition-all",
        selected
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
          : "hover:border-muted-foreground/30"
      )}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <Checkbox checked={selected} className="mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium truncate">{story.title}</h4>
            <Badge variant="secondary" className="shrink-0">
              {story.storyPoints || 0} SP
            </Badge>
            {story.priority && (
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 text-xs",
                  story.priority === "Critical" && "border-red-500 text-red-600",
                  story.priority === "High" && "border-orange-500 text-orange-600",
                  story.priority === "Medium" && "border-yellow-500 text-yellow-600",
                  story.priority === "Low" && "border-green-500 text-green-600"
                )}
              >
                {story.priority}
              </Badge>
            )}
          </div>
          {story.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {story.description}
            </p>
          )}
          {expanded && story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
            <div className="mt-2 text-sm text-muted-foreground">
              <p className="font-medium text-xs mb-1">Acceptance Criteria:</p>
              <ul className="list-disc list-inside space-y-1">
                {story.acceptanceCriteria.slice(0, 3).map((ac, i) => (
                  <li key={i} className="truncate text-xs">
                    {ac}
                  </li>
                ))}
                {story.acceptanceCriteria.length > 3 && (
                  <li className="text-xs text-muted-foreground">
                    +{story.acceptanceCriteria.length - 3} more...
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
        {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// Capacity Indicator Component
function CapacityIndicator({
  points,
  duration,
  teamSize,
}: {
  points: number;
  duration: number;
  teamSize: number;
}) {
  // Rough estimate: 10 points per person per week
  const capacity = teamSize * duration * 10;
  const utilization = capacity > 0 ? (points / capacity) * 100 : 0;

  let status: "green" | "yellow" | "red" = "green";
  let message = "Good fit";

  if (utilization > 100) {
    status = "red";
    message = "Over capacity";
  } else if (utilization > 80) {
    status = "yellow";
    message = "Near capacity";
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm",
        status === "green" && "text-green-600",
        status === "yellow" && "text-yellow-600",
        status === "red" && "text-red-600"
      )}
    >
      {status === "green" && <CheckCircle className="h-4 w-4" />}
      {status === "yellow" && <AlertCircle className="h-4 w-4" />}
      {status === "red" && <XCircle className="h-4 w-4" />}
      {message}
    </div>
  );
}

export default function SprintAssistant({
  stories,
  teamMembers,
  workspaceId,
  initialSelectedStories,
  onSprintCreated: _onSprintCreated,
  onClose,
  onSaveSprints,
}: SprintAssistantProps) {
  const [selectedStories, setSelectedStories] = useState<string[]>(
    initialSelectedStories || []
  );
  const [sprintName, setSprintName] = useState(
    `Sprint ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
  );
  const [duration, setDuration] = useState(2);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [isCreating, setIsCreating] = useState(false);
  const { user } = useAuth();
  const { toast } = useEnhancedToast();
  const sprintStartRef = useRef<number | null>(null);

  // Calculate total points for selected stories
  const totalPoints = useMemo(() => {
    return stories
      .filter((s) => selectedStories.includes(s.id))
      .reduce((sum, s) => sum + (s.storyPoints || 0), 0);
  }, [stories, selectedStories]);

  // Calculate estimated hours (rough estimate: 1 SP = 2 hours)
  const estimatedHours = useMemo(() => totalPoints * 2, [totalPoints]);

  // Calculate end date based on start date and duration
  const endDate = useMemo(() => {
    if (!startDate) return undefined;
    const end = new Date(startDate);
    end.setDate(startDate.getDate() + duration * 7 - 1);
    return end;
  }, [startDate, duration]);

  // Calculate team capacity
  const teamCapacity = useMemo(() => {
    const totalWeeklyHours = teamMembers.reduce(
      (sum, member) => sum + (member.availability || 40),
      0
    );
    const sprintHours = totalWeeklyHours * duration;
    const sprintPoints = Math.floor(sprintHours / HOURS_PER_STORY_POINT);
    return sprintPoints;
  }, [teamMembers, duration]);

  // Toggle story selection
  const toggleStory = useCallback((storyId: string) => {
    setSelectedStories((prev) =>
      prev.includes(storyId)
        ? prev.filter((id) => id !== storyId)
        : [...prev, storyId]
    );
  }, []);

  // Validation for create button
  const canCreate = sprintName.trim().length > 0 && selectedStories.length > 0 && !isCreating;

  // Handle keyboard shortcut (Ctrl+Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (canCreate) {
          handleCreateSprint();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canCreate]);

  // Start timer when component mounts
  useEffect(() => {
    sprintStartRef.current = Date.now();
  }, []);

  // Create sprint handler — uses AI optimization via createSprintFromStories
  const handleCreateSprint = async () => {
    if (selectedStories.length === 0) {
      toast({
        title: "No stories selected",
        description: "Please select at least one story for the sprint.",
        variant: "destructive",
      });
      return;
    }

    if (!sprintName.trim()) {
      toast({
        title: "Sprint name required",
        description: "Please enter a name for the sprint.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      const selectedStoryObjects = stories.filter((story) =>
        selectedStories.includes(story.id)
      );

      // Call AI sprint optimization — handles dependency grouping, priority sorting, capacity, and goal generation
      const { sprint: aiSprint, error: aiError } = await createSprintFromStories(
        selectedStoryObjects,
        teamMembers,
        duration,
        workspaceId
      );

      let sprintGoal: string;
      let sprintStories: UserStory[];

      if (aiError) {
        console.warn("AI sprint optimization failed, using basic optimization:", aiError);
        sprintGoal = `Complete ${selectedStoryObjects.length} stories (${totalPoints} points)`;
        sprintStories = selectedStoryObjects;
      } else if (aiSprint) {
        // Use AI-optimized sprint — may have fewer stories if capacity was exceeded
        sprintGoal = aiSprint.goal || `Complete ${aiSprint.stories.length} stories`;
        sprintStories = aiSprint.stories;
      } else {
        sprintGoal = `Complete ${selectedStoryObjects.length} stories (${totalPoints} points)`;
        sprintStories = selectedStoryObjects;
      }

      const actualPoints = sprintStories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
      const utilization = teamCapacity > 0
        ? (actualPoints / teamCapacity) * 100
        : 0;

      const newSprint: ManualSprint = {
        id: `st${nanoid(6)}`,
        name: sprintName,
        duration: duration,
        selectedStories: sprintStories,
        capacity: teamCapacity,
        utilization,
        goal: sprintGoal,
        startDate: startDate?.toISOString().slice(0, 10),
        endDate: endDate?.toISOString().slice(0, 10),
      };

      // Save the sprint via unified AI flow
      onSaveSprints([newSprint], "ai");

      toast({
        title: "Sprint optimized!",
        description: `${sprintName} created with ${sprintStories.length} stories.`,
      });

      onClose();
    } catch (error) {
      console.error("Error creating sprint:", error);
      toast({
        title: "Error creating sprint",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Select/deselect all stories
  const handleSelectAll = () => {
    if (selectedStories.length === stories.length) {
      setSelectedStories([]);
    } else {
      setSelectedStories(stories.map((s) => s.id));
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-emerald-500" />
            Turbo Sprint Planner
          </DialogTitle>
          <DialogDescription>
            Select stories and let AI optimize your sprint with dependency grouping, priority sorting, and capacity planning
          </DialogDescription>
        </DialogHeader>

        {/* Sprint Configuration - TOP */}
        <div className="flex-shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-4 bg-muted/50 border-y">
          <div className="space-y-2">
            <Label htmlFor="sprint-name">
              Sprint Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="sprint-name"
              value={sprintName}
              onChange={(e) => setSprintName(e.target.value)}
              placeholder="e.g., Sprint 2 - User Authentication"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Duration</Label>
            <Select
              value={String(duration)}
              onValueChange={(v) => setDuration(Number(v))}
            >
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 week</SelectItem>
                <SelectItem value="2">2 weeks</SelectItem>
                <SelectItem value="3">3 weeks</SelectItem>
                <SelectItem value="4">4 weeks</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <MobileDatePicker
              date={startDate}
              onDateChange={setStartDate}
              placeholder="Pick start date"
              className="w-full"
            />
          </div>
        </div>

        {/* Story Selection - SCROLLABLE */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Select Stories</h3>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {stories.length} available
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="text-xs"
              >
                {selectedStories.length === stories.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>
          </div>

          {stories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No stories available.</p>
              <p className="text-sm mt-1">
                Generate some user stories first to create a sprint.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {stories.map((story) => (
                <StorySelectionCard
                  key={story.id}
                  story={story}
                  selected={selectedStories.includes(story.id)}
                  onToggle={() => toggleStory(story.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Summary - FIXED BOTTOM */}
        <div className="flex-shrink-0 border-t px-6 py-4 bg-background">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 sm:gap-6 text-sm flex-wrap">
              <span>
                <strong>{selectedStories.length}</strong> stories selected
              </span>
              <span>
                <strong>{totalPoints}</strong> points
              </span>
              <span>
                ~<strong>{estimatedHours}</strong> hours
              </span>
            </div>
            <CapacityIndicator
              points={totalPoints}
              duration={duration}
              teamSize={teamMembers?.length || 1}
            />
          </div>

          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            size="lg"
            disabled={!canCreate}
            onClick={handleCreateSprint}
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Optimizing Sprint...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Create Sprint
              </>
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Ctrl + Enter to create
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
