"use client";

import type React from "react";
import { useState, useEffect, useCallback } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  WorkspaceBase,
  SpaceBase,
  SprintBase,
  SprintFolderBase,
} from "@/types/display-types";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import { MobileDatePicker } from "@/components/ui/mobile-date-picker";
import { SPRINT_FOLDER_COLUMNS, PROFILE_COLUMNS } from "@/lib/query-columns";
import {
  createSprintFolder,
  ensureDefaultSprintFolder as ensureDefaultSprintFolderUtil,
} from "@/lib/sprint-folder-utils";

interface CreateSprintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (sprint: SprintBase) => void;
  workspace: WorkspaceBase;
  space?: SpaceBase;
  sprintFolder?: SprintFolderBase;
}

export default function CreateSprintModal({
  open,
  onOpenChange,
  onSuccess,
  workspace,
  space,
  sprintFolder: propsSprintFolder,
}: CreateSprintModalProps) {
  const [sprintName, setSprintName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedSprintFolderId, setSelectedSprintFolderId] = useState(
    propsSprintFolder?.id || ""
  );
  const [sprintFolders, setSprintFolders] = useState<SprintFolderBase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isAutoCreatingFolder, setIsAutoCreatingFolder] = useState(false);
  const [supabase] = useState(() => createClientSupabaseClient());
  const { toast } = useEnhancedToast();

  const ensureDefaultSprintFolder = useCallback(async () => {
    if (!space?.id || isAutoCreatingFolder) return null;

    setIsAutoCreatingFolder(true);
    try {
      // First, get a project for this space (required for sprint folder)
      const { data: projects } = await supabase
        .from("projects")
        .select("id")
        .eq("space_id", space.id)
        .is("deleted_at", null)
        .limit(1);

      if (!projects || projects.length === 0) {
        console.error("No projects found for space, cannot create sprint folder");
        setShowCreateFolder(true);
        return null;
      }

      const folder = await ensureDefaultSprintFolderUtil({
        spaceId: space.id,
        projectId: projects[0].id,
        defaultName: "Default",
      });

      if (!folder) {
        setShowCreateFolder(true);
        return null;
      }

      setSprintFolders([folder as SprintFolderBase]);
      setSelectedSprintFolderId(folder.id);

      // Only show toast if folder was newly created (check if it already exists in local state)
      if (sprintFolders.length === 0) {
        toast({
          title: "Sprint folder ready",
          description: "Added a Default sprint folder for this space.",
        });
      }

      return folder as SprintFolderBase;
    } catch (err: any) {
      console.error("Error ensuring default sprint folder:", err);
      setShowCreateFolder(true);
      return null;
    } finally {
      setIsAutoCreatingFolder(false);
    }
  }, [space?.id, toast, isAutoCreatingFolder, sprintFolders.length]);

  // Update selected sprint folder when prop changes
  useEffect(() => {
    if (propsSprintFolder) {
      setSelectedSprintFolderId(propsSprintFolder.id);
    }
  }, [propsSprintFolder]);

  const fetchSprintFolders = useCallback(async () => {
    if (!space?.id) {
      setSprintFolders([]);
      setSelectedSprintFolderId("");
      return;
    }

    try {
      const { data: sprintFoldersData, error } = await supabase
        .from("sprint_folders")
        .select(SPRINT_FOLDER_COLUMNS.CORE)
        .eq("space_id", space.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching sprint folders:", error);
        setShowCreateFolder(true);
        return;
      }

      if (!sprintFoldersData || sprintFoldersData.length === 0) {
        await ensureDefaultSprintFolder();
        return;
      }

      setSprintFolders(sprintFoldersData as SprintFolderBase[]);
      if (!selectedSprintFolderId) {
        setSelectedSprintFolderId(sprintFoldersData[0].id);
      }
    } catch (error) {
      console.error("Error fetching sprint folders:", error);
      setShowCreateFolder(true);
    }
  }, [space?.id, supabase, ensureDefaultSprintFolder, selectedSprintFolderId]);

  // Fetch sprint folders when modal opens
  useEffect(() => {
    if (open) {
      fetchSprintFolders();
    }
  }, [open, fetchSprintFolders]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !space) return;

    setIsCreatingFolder(true);
    try {
      // Get a project for this space (required for sprint folder)
      const { data: projects } = await supabase
        .from("projects")
        .select("id")
        .eq("space_id", space.id)
        .is("deleted_at", null)
        .limit(1);

      if (!projects || projects.length === 0) {
        throw new Error("No projects found for this space. Please create a project first.");
      }

      const newFolder = await createSprintFolder({
        spaceId: space.id,
        projectId: projects[0].id,
        name: newFolderName.trim(),
      });

      // Add to folders list and select it
      setSprintFolders([...sprintFolders, newFolder as SprintFolderBase]);
      setSelectedSprintFolderId(newFolder.id);
      setNewFolderName("");
      setShowCreateFolder(false);

      toast({
        title: "Sprint folder created",
        description: `Folder "${newFolderName.trim()}" has been created.`,
      });
    } catch (err: any) {
      console.error("Error creating sprint folder:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to create sprint folder.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    setIsLoading(true);

    if (!sprintName.trim()) {
      setError("Sprint name cannot be empty.");
      setIsLoading(false);
      return;
    }

    if (!selectedSprintFolderId) {
      setError("Please select a sprint folder.");
      setIsLoading(false);
      return;
    }

    if (!space) {
      setError("Space is required.");
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

      const { data: sprint, error: sprintError } = await supabase
        .from("sprints")
        .insert({
          name: sprintName.trim(),
          goal: goal.trim() || null,
          start_date: startDate ? startDate.toISOString().split("T")[0] : null,
          end_date: endDate ? endDate.toISOString().split("T")[0] : null,
          sprint_folder_id: selectedSprintFolderId,
          space_id: space!.id,
          workspace_id: workspace.id,
          status: "planned",
        })
        .select()
        .single();

      if (sprintError) {
        throw sprintError;
      }

      // PHASE_6_NOOP: was Resend email-notification dispatch, OSS has no transactional email

      toast({
        title: "Sprint created",
        description: `Sprint "${sprintName.trim()}" has been created successfully.`,
        browserNotificationTitle: "Sprint created",
        browserNotificationBody: `Sprint "${sprintName.trim()}" has been created successfully.`,
      });

      onSuccess(sprint as SprintBase);
      onOpenChange(false);

      // Dispatch custom event for sidebar synchronization
      window.dispatchEvent(
        new CustomEvent("sprintCreated", {
          detail: { sprint, space },
        })
      );

      // Reset form
      setSprintName("");
      setGoal("");
      setStartDate(undefined);
      setEndDate(undefined);
      setSelectedSprintFolderId("");
    } catch (err: any) {
      console.error("Error creating sprint:", err);
      setError(err.message || "Failed to create sprint.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Sprint</DialogTitle>
            <DialogDescription>
              Create a new sprint to organize and track your work.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            {error && <p className="text-red-500 text-sm">{error}</p>}

            {!space && (
              <p className="text-red-500 text-sm">
                No space selected. Please select a space first.
              </p>
            )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sprintName" className="text-right">
              Name
            </Label>
            <div className="col-span-3">
              <Input
                id="sprintName"
                value={sprintName}
                onChange={(e) => setSprintName(e.target.value)}
                placeholder="Enter sprint name"
                maxLength={100}
                required
              />
              <p className="text-xs text-gray-500 text-right mt-1">
                {sprintName.length}/100 characters
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="goal" className="text-right">
              Goal
            </Label>
            <div className="col-span-3">
              <Textarea
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What do you want to achieve in this sprint?"
                rows={3}
                maxLength={1000}
              />
              <p className="text-xs text-gray-500 text-right mt-1">
                {goal.length}/1000 characters
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sprintFolder" className="text-right">
              Sprint Folder
            </Label>
            <div className="col-span-3 space-y-2">
              {!showCreateFolder ? (
                <>
                  <Select
                    value={selectedSprintFolderId}
                    onValueChange={setSelectedSprintFolderId}
                    disabled={sprintFolders.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={sprintFolders.length === 0 ? "No folders available" : "Select a sprint folder"} />
                    </SelectTrigger>
                    <SelectContent>
                      {sprintFolders.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {sprintFolders.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No sprint folders found. Create one to get started.
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateFolder(true)}
                    className="w-full"
                  >
                    + Create Sprint Folder
                  </Button>
                </>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder name (e.g., Q1 Sprints)"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateFolder();
                      }
                      if (e.key === "Escape") {
                        setShowCreateFolder(false);
                        setNewFolderName("");
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim() || isCreatingFolder}
                  >
                    {isCreatingFolder ? "Creating..." : "Create"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowCreateFolder(false);
                      setNewFolderName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Start Date</Label>
            <div className="col-span-3">
              <MobileDatePicker
                date={startDate}
                onDateChange={setStartDate}
                placeholder="Pick a start date"
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">End Date</Label>
            <div className="col-span-3">
              <MobileDatePicker
                date={endDate}
                onDateChange={setEndDate}
                placeholder="Pick an end date"
                minDate={startDate}
                className="w-full"
              />
            </div>
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
            <Button
              type="submit"
              disabled={isLoading || !space}
              variant="workspace"
            >
              {isLoading ? "Creating..." : "Create Sprint"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
