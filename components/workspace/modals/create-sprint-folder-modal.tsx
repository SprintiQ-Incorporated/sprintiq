"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { fetchWithCsrf } from "@/lib/csrf-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import { PROJECT_COLUMNS, PROFILE_COLUMNS } from "@/lib/query-columns";
import type {
  WorkspaceBase,
  SpaceBase,
  SprintFolderBase,
  ProjectBase,
  DayDisplay,
} from "@/types/display-types";

interface CreateSprintFolderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (sprintFolder: SprintFolderBase) => void;
  workspace: WorkspaceBase;
  spaces: SpaceBase[];
  selectedSpaceId?: string;
  selectedProjectId?: string;
  projects?: ProjectBase[];
}

export default function CreateSprintFolderModal({
  open,
  onOpenChange,
  onSuccess,
  workspace,
  spaces,
  selectedSpaceId: propsSelectedSpaceId,
  selectedProjectId: propsSelectedProjectId,
  projects: propsProjects,
}: CreateSprintFolderModalProps) {
  const [sprintFolderName, setSprintFolderName] = useState("");
  const [selectedSpaceId, setSelectedSpaceId] = useState(
    propsSelectedSpaceId || ""
  );
  const [selectedProjectId, setSelectedProjectId] = useState(
    propsSelectedProjectId || ""
  );
  const [availableProjects, setAvailableProjects] = useState<ProjectBase[]>(
    propsProjects || []
  );
  const [durationWeeks, setDurationWeeks] = useState(2);
  const [startDayId, setStartDayId] = useState<string>("");
  const [days, setDays] = useState<DayDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabase] = useState(() => createClientSupabaseClient());
  const { toast } = useEnhancedToast();

  // Fetch days when modal opens
  useEffect(() => {
    if (open) {
      fetchDays();
    }
  }, [open]);

  // Update selected space when prop changes
  useEffect(() => {
    if (propsSelectedSpaceId) {
      setSelectedSpaceId(propsSelectedSpaceId);
    }
  }, [propsSelectedSpaceId]);

  // Update selected project when prop changes
  useEffect(() => {
    if (propsSelectedProjectId) {
      setSelectedProjectId(propsSelectedProjectId);
    }
  }, [propsSelectedProjectId]);

  // Update available projects when props change or space changes
  useEffect(() => {
    if (propsProjects) {
      setAvailableProjects(propsProjects);
    } else if (selectedSpaceId) {
      // Fetch projects for the selected space
      const fetchProjects = async () => {
        const { data: projectsData } = await supabase
          .from("projects")
          .select(PROJECT_COLUMNS.CORE)
          .or(`space_id.eq.${selectedSpaceId}`)
          .is("deleted_at", null);
        if (projectsData) {
          setAvailableProjects(projectsData);
        }
      };
      fetchProjects();
    }
  }, [propsProjects, selectedSpaceId, supabase]);

  const fetchDays = async () => {
    try {
      const { data: daysData, error } = await supabase
        .from("days")
        .select("id, name");

      if (error) {
        console.error("Error fetching days:", error);
        toast({
          title: "Couldn't load start days",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (!daysData || daysData.length === 0) {
        toast({
          title: "Start days not configured",
          description:
            "The 'days' reference table is empty. Re-run the OSS baseline migration to seed it.",
          variant: "destructive",
        });
        return;
      }

      // Sort Monday → Sunday, not alphabetically
      const order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      const sorted = [...daysData].sort(
        (a, b) => order.indexOf(a.name.toLowerCase()) - order.indexOf(b.name.toLowerCase())
      );
      setDays(sorted);

      // Default to Monday (case-insensitive — seed uses "Monday")
      const monday = sorted.find((day) => day.name.toLowerCase() === "monday");
      if (monday) {
        setStartDayId(monday.id);
      }
    } catch (error: any) {
      console.error("Error fetching days:", error);
      toast({
        title: "Couldn't load start days",
        description: error?.message || "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!sprintFolderName.trim()) {
      setError("Sprint folder name cannot be empty.");
      setIsLoading(false);
      return;
    }

    if (!selectedSpaceId) {
      setError("Please select a space.");
      setIsLoading(false);
      return;
    }

    if (!selectedProjectId) {
      setError("Please select a project.");
      setIsLoading(false);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("User not authenticated.");
        setIsLoading(false);
        return;
      }

      // Find the selected space to get its UUID
      const selectedSpace = spaces.find(
        (space) => space.id === selectedSpaceId
      );
      if (!selectedSpace) {
        setError("Selected space not found.");
        setIsLoading(false);
        return;
      }

      const { data: sprintFolder, error: sprintFolderError } = await supabase
        .from("sprint_folders")
        .insert({
          name: sprintFolderName.trim(),
          sprint_start_day_id: startDayId || null,
          duration_week: durationWeeks,
          space_id: selectedSpace.id,
          project_id: selectedProjectId,
        })
        .select()
        .single();

      if (sprintFolderError) {
        throw sprintFolderError;
      }

      // PHASE_6_NOOP: was Resend email-notification dispatch, OSS has no transactional email

      toast({
        title: "Sprint folder created",
        description: `Sprint folder "${sprintFolderName.trim()}" has been created successfully.`,
        browserNotificationTitle: "Sprint folder created",
        browserNotificationBody: `Sprint folder "${sprintFolderName.trim()}" has been created successfully.`,
      });

      onSuccess(sprintFolder);
      onOpenChange(false);

      // Reset form
      setSprintFolderName("");
      setSelectedSpaceId("");
      setSelectedProjectId("");
      setDurationWeeks(2);
      setStartDayId("");
    } catch (err: any) {
      console.error("Error creating sprint folder:", err);
      setError(err.message || "Failed to create sprint folder.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Sprint Folder</DialogTitle>
          <DialogDescription>
            Sprint folders help you organize sprints within a project.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sprintFolderName" className="text-right">
              Name
            </Label>
            <div className="col-span-3">
              <Input
                id="sprintFolderName"
                value={sprintFolderName}
                onChange={(e) => setSprintFolderName(e.target.value)}
                placeholder="Enter sprint folder name"
                maxLength={100}
                required
              />
              <p className="text-xs text-gray-500 text-right mt-1">
                {sprintFolderName.length}/100 characters
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="space" className="text-right">
              Space
            </Label>
            <Select value={selectedSpaceId} onValueChange={(value) => {
              setSelectedSpaceId(value);
              // Reset project when space changes
              if (!propsSelectedProjectId) {
                setSelectedProjectId("");
              }
            }}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a space" />
              </SelectTrigger>
              <SelectContent>
                {spaces.map((space) => (
                  <SelectItem key={space.id} value={space.id}>
                    {space.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="project" className="text-right">
              Project
            </Label>
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
              disabled={!selectedSpaceId || availableProjects.length === 0}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder={
                  !selectedSpaceId
                    ? "Select a space first"
                    : availableProjects.length === 0
                      ? "No projects in this space"
                      : "Select a project"
                } />
              </SelectTrigger>
              <SelectContent>
                {availableProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="durationWeeks" className="text-right">
              Duration
            </Label>
            <Select
              value={durationWeeks.toString()}
              onValueChange={(value) => setDurationWeeks(parseInt(value))}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 week</SelectItem>
                <SelectItem value="2">2 weeks</SelectItem>
                <SelectItem value="3">3 weeks</SelectItem>
                <SelectItem value="4">4 weeks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="startDay" className="text-right">
              Start Day
            </Label>
            <Select value={startDayId} onValueChange={setStartDayId}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select start day" />
              </SelectTrigger>
              <SelectContent>
                {days.map((day) => (
                  <SelectItem key={day.id} value={day.id}>
                    {day.name.charAt(0).toUpperCase() + day.name.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} variant="workspace">
              {isLoading ? "Creating..." : "Create Sprint Folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
