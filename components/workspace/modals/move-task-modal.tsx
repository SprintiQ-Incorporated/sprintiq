"use client";

import { useState, useEffect, useMemo } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, FolderKanban, AlertCircle } from "lucide-react";
import { csrfFetch } from "@/hooks/useCsrfFetch";

interface Workspace {
  id: string;
  workspace_id: string;
  name?: string;
}

interface MoveTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskIds: string[];
  currentProjectId?: string;
  onSuccess?: () => void;
  workspace: Workspace;
}

export function MoveTaskModal({
  isOpen,
  onClose,
  taskIds,
  currentProjectId,
  onSuccess,
  workspace,
}: MoveTaskModalProps) {
  const supabase = useMemo(() => createClientSupabaseClient(), []);

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [clearSprint, setClearSprint] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // Fetch available projects
  useEffect(() => {
    if (!isOpen || !workspace?.id) return;

    const fetchProjects = async () => {
      setIsFetching(true);
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, space_id, spaces(name)")
        .eq("workspace_id", workspace.id)
        .is("deleted_at", null)
        .order("name");

      if (!error && data) {
        // Filter out current project
        const otherProjects = data.filter(p => p.id !== currentProjectId);
        setProjects(otherProjects);
      }
      setIsFetching(false);
    };

    fetchProjects();
  }, [isOpen, workspace?.id, currentProjectId, supabase]);

  const handleMove = async () => {
    if (!selectedProjectId || !workspace?.id) return;

    setIsLoading(true);

    try {
      const response = await csrfFetch(
        `/api/workspace/${workspace.workspace_id}/tasks/move`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskIds,
            targetProjectId: selectedProjectId,
            clearSprint,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to move tasks");
      }

      const movedCount = data.moved?.length || 0;
      const skippedCount = data.skipped?.length || 0;

      toast({
        title: "Tasks moved",
        description: `Moved ${movedCount} task${movedCount !== 1 ? "s" : ""} to "${data.targetProject.name}"${
          skippedCount > 0 ? `. ${skippedCount} skipped.` : ""
        }`,
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Move error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to move tasks",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby="move-task-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            Move {taskIds.length === 1 ? "Task" : `${taskIds.length} Tasks`}
          </DialogTitle>
          <DialogDescription id="move-task-description">
            Select a project to move the selected task{taskIds.length !== 1 ? "s" : ""} to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project Selection */}
          <div className="space-y-2">
            <Label>Target Project</Label>
            {isFetching ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertCircle className="h-4 w-4" />
                No other projects available
              </div>
            ) : (
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex flex-col">
                        <span>{project.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {project.spaces?.name || "No space"}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-sm text-muted-foreground">Options</Label>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="clearSprint"
                checked={clearSprint}
                onCheckedChange={(checked) => setClearSprint(checked as boolean)}
              />
              <Label htmlFor="clearSprint" className="text-sm font-normal">
                Remove from current sprint
              </Label>
            </div>
          </div>

          {/* Warning */}
          {selectedProject && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
              <p className="text-amber-800 dark:text-amber-200">
                Tasks will be moved to <strong>{selectedProject.name}</strong>
                {selectedProject.spaces?.name && (
                  <> in space <strong>{selectedProject.spaces.name}</strong></>
                )}
                .
              </p>
              {clearSprint && (
                <p className="mt-1 text-amber-700 dark:text-amber-300">
                  • Sprint assignments will be removed
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={!selectedProjectId || isLoading || projects.length === 0}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Move {taskIds.length === 1 ? "Task" : "Tasks"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MoveTaskModal;
