"use client";

import type React from "react";

import { useState } from "react";
import { fetchWithCsrf } from "@/lib/csrf-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";

import { PROFILE_COLUMNS, PROJECT_COLUMNS } from "@/lib/query-columns";
import { ensureDefaultSprintFolder } from "@/lib/sprint-folder-utils";
import type {
  WorkspaceBase,
  SpaceBase,
  ProjectBase,
  SprintFolderWithSprints,
} from "@/types/display-types";

const spaceIcons = [
  { value: "blue", label: "Blue", color: "bg-blue-500" },
  { value: "green", label: "Green", color: "bg-green-500" },
  { value: "red", label: "Red", color: "bg-red-500" },
  { value: "purple", label: "Purple", color: "bg-purple-500" },
  { value: "yellow", label: "Yellow", color: "bg-yellow-500" },
  { value: "pink", label: "Pink", color: "bg-pink-500" },
];

type NewSpaceWithProjects = SpaceBase & {
  projects: ProjectBase[];
  sprint_folders: SprintFolderWithSprints[];
};

interface CreateSpaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newSpace: NewSpaceWithProjects) => void;
  workspace: WorkspaceBase;
  spaces?: SpaceBase[];
}

export default function CreateSpaceModal({
  open,
  onOpenChange,
  onSuccess,
  workspace,
}: CreateSpaceModalProps) {
  const { toast } = useEnhancedToast();
  const supabase = createClientSupabaseClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("blue");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createSpace();
  };

  const createSpace = async () => {
    setIsLoading(true);

    try {
      const { data: space, error } = await supabase
        .from("spaces")
        .insert({
          name,
          description,
          icon,
          workspace_id: workspace.id,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          name: "Getting Started",
          space_id: space.id,
          workspace_id: workspace.id,
        })
        .select(PROJECT_COLUMNS.CORE)
        .single();

      if (projectError) {
        throw projectError;
      }

      if (!project?.project_id) {
        console.error("Getting Started project missing project_id:", project);
        throw new Error("Project created but missing required project_id");
      }

      await ensureDefaultSprintFolder({
        spaceId: space.id,
        projectId: project.id,
        defaultName: "Default",
      });

      // PHASE_6_NOOP: was Resend email-notification dispatch, OSS has no transactional email

      toast({
        title: "Portfolio item created",
        description: `${space.name} has been created successfully.`,
        browserNotificationTitle: "Portfolio item created",
        browserNotificationBody: `${space.name} has been created successfully.`,
      });

      setName("");
      setDescription("");
      setIcon("blue");

      onOpenChange(false);

      const newSpaceWithProjects: NewSpaceWithProjects = {
        ...space,
        projects: [project],
        sprint_folders: [],
      };

      if (onSuccess) {
        onSuccess(newSpaceWithProjects);
      }

      window.dispatchEvent(
        new CustomEvent("spaceCreated", {
          detail: { space: newSpaceWithProjects },
        })
      );
    } catch (error: any) {
      console.error("Error creating space:", error);
      toast({
        title: "Error creating portfolio item",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create a Portfolio Item</DialogTitle>
          <DialogDescription>
            A Portfolio item represents teams, departments, or groups, each with its own
            projects, workflows, and settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-4">
            <div>
              <Label>Icon & name</Label>
              <div className="flex items-center gap-2 mt-1">
                <Select value={icon} onValueChange={setIcon}>
                  <SelectTrigger className="w-12 h-12 p-0 justify-center border-2">
                    <div
                      className={`w-8 h-8 ${
                        spaceIcons.find((i) => i.value === icon)?.color ||
                        "bg-blue-500"
                      } rounded-md flex items-center justify-center text-white font-medium`}
                    >
                      {name.charAt(0).toUpperCase() || "S"}
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {spaceIcons.map((iconOpt) => (
                      <SelectItem key={iconOpt.value} value={iconOpt.value}>
                        <div className="flex items-center">
                          <div
                            className={`w-4 h-4 ${iconOpt.color} rounded-sm mr-2`}
                          ></div>
                          {iconOpt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Marketing, Engineering, HR"
                  className="flex-1"
                  maxLength={100}
                  required
                />
              </div>
              <p className="text-xs text-gray-500 text-right mt-1">
                {name.length}/100 characters
              </p>
            </div>

            <div>
              <Label htmlFor="description">
                Description{" "}
                <span className="text-gray-500 text-sm">(optional)</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this space for?"
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 text-right mt-1">
                {description.length}/500 characters
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="workspace" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Portfolio Item"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
