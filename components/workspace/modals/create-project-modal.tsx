"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchWithCsrf } from "@/lib/csrf-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  SelectValue,
} from "@/components/ui/select";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import type { Workspace, Space, Project } from "@/lib/database-aliases";
import { PROFILE_COLUMNS } from "@/lib/query-columns";

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (project: Project) => void;
  workspace: Workspace;
  spaces: (Space & { projects: Project[] })[];
  selectedSpaceId?: string;
}

export default function CreateProjectModal({
  open,
  onOpenChange,
  onSuccess,
  workspace,
  spaces,
  selectedSpaceId: propsSelectedSpaceId,
}: CreateProjectModalProps) {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const { toast } = useEnhancedToast();
  const supabase = createClientSupabaseClient();

  const [name, setName] = useState("");
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setName("");
      // If a specific space was selected when opening the modal, use that
      if (propsSelectedSpaceId) {
        setSelectedSpaceId(propsSelectedSpaceId);
      } else {
        setSelectedSpaceId(spaces.length > 0 ? spaces[0].id : ""); // Use UUID id
      }
      setIsPrivate(false);
    }
  }, [open, spaces, propsSelectedSpaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedSpaceId) return;

    setIsLoading(true);

    try {
      // Find the selected space
      const selectedSpace = spaces.find(
        (space) => space.id === selectedSpaceId
      );
      if (!selectedSpace) {
        throw new Error("Selected space not found");
      }

      // Create the project
      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          name: name.trim(),
          space_id: selectedSpace.id, // Use the UUID id for foreign key
          workspace_id: workspace.id,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // PHASE_6_NOOP: was Resend email-notification dispatch, OSS has no transactional email

      toast({
        title: "Project created",
        description: `${name} project has been created successfully.`,
        browserNotificationTitle: "Project created",
        browserNotificationBody: `${name} project has been created successfully.`,
      });

      // Reset form
      setName("");
      setSelectedSpaceId("");
      setIsPrivate(false);

      // Close modal
      onOpenChange(false);

      // Pass the created project to the onSuccess callback
      if (onSuccess) {
        onSuccess(project as Project);
      }

      // Navigate to the new project using the short IDs
      router.push(
        `/${workspaceId}/space/${selectedSpace.space_id}/project/${project.project_id}`
      );
    } catch (error: any) {
      console.error("Error creating project:", error);
      toast({
        title: "Error creating project",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Create a Project</DialogTitle>
            <DialogDescription>
              Projects help you organize your work within a space.
            </DialogDescription>
          </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Website Redesign, Mobile App"
                className="mt-1"
                maxLength={100}
                required
              />
              <p className="text-xs text-gray-500 text-right mt-1">
                {name.length}/100 characters
              </p>
            </div>

            <div>
              <Label htmlFor="space-select">Space</Label>
              <Select
                value={selectedSpaceId}
                onValueChange={setSelectedSpaceId}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a space" />
                </SelectTrigger>
                <SelectContent>
                  {spaces.map((space) => (
                    <SelectItem key={space.id} value={space.id}>
                      <div className="flex items-center">
                        <div
                          className={`w-3 h-3 rounded-sm mr-2 ${
                            space.icon === "blue"
                              ? "bg-blue-500"
                              : space.icon === "green"
                              ? "bg-green-500"
                              : space.icon === "red"
                              ? "bg-red-500"
                              : space.icon === "purple"
                              ? "bg-purple-500"
                              : space.icon === "yellow"
                              ? "bg-yellow-500"
                              : space.icon === "pink"
                              ? "bg-pink-500"
                              : "bg-blue-500"
                          }`}
                        />
                        {space.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="private-project">Make Private</Label>
                <p className="text-sm text-gray-500">
                  Only you and invited members have access
                </p>
              </div>
              <Switch
                id="private-project"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
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
            <Button
              type="submit"
              disabled={isLoading || !name.trim() || !selectedSpaceId}
              variant="workspace"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
