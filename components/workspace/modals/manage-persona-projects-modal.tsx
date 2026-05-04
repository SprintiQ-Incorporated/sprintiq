"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  FolderKanban,
  Check,
  Loader2,
  Users2,
} from "lucide-react";
import { Persona, Project } from "@/lib/database-aliases";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";

interface ManagePersonaProjectsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  persona: Persona;
  workspaceId: string;
  onUpdate?: () => void;
}

interface ProjectWithAssociation extends Project {
  isAssociated: boolean;
  spaceName?: string;
}

export function ManagePersonaProjectsModal({
  open,
  onOpenChange,
  persona,
  workspaceId,
  onUpdate,
}: ManagePersonaProjectsModalProps) {
  const { user } = useAuth();
  const { toast } = useEnhancedToast();
  const supabase = createClientSupabaseClient();

  const [projects, setProjects] = useState<ProjectWithAssociation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    new Set()
  );
  const [initialSelectedProjects, setInitialSelectedProjects] = useState<
    Set<string>
  >(new Set());

  useEffect(() => {
    if (open && persona) {
      fetchProjectsWithAssociations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, persona]);

  const fetchProjectsWithAssociations = async () => {
    try {
      setLoading(true);

      // First, get the workspace record to get the correct ID
      const { data: workspaceData, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (workspaceError || !workspaceData) {
        return;
      }

      // Fetch all projects in the workspace
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select(
          `
          *,
          space:spaces(name)
        `
        )
        .or(
          `workspace_id.eq.${workspaceData.id},space_id.in.(select id from spaces where workspace_id='${workspaceData.id}')`
        )
        .is("deleted_at", null)
        .order("name");

      if (projectsError) {
        return;
      }

      // Fetch existing persona-project associations
      const { data: associationsData } =
        await supabase
          .from("project_personas")
          .select("project_id")
          .eq("persona_id", persona.id);

      // Continue even if associations fail (table might not exist yet)

      const associatedProjectIds = new Set(
        (associationsData || []).map((a) => a.project_id)
      );

      const projectsWithAssociation: ProjectWithAssociation[] = (
        projectsData || []
      ).map((project: any) => ({
        ...project,
        isAssociated: associatedProjectIds.has(project.id),
        spaceName: project?.space?.name,
      }));

      setProjects(projectsWithAssociation);
      setSelectedProjects(associatedProjectIds);
      setInitialSelectedProjects(new Set(associatedProjectIds));
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleToggleProject = (projectId: string) => {
    setSelectedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Find projects to add and remove
      const projectsToAdd = [...selectedProjects].filter(
        (id) => !initialSelectedProjects.has(id)
      );
      const projectsToRemove = [...initialSelectedProjects].filter(
        (id) => !selectedProjects.has(id)
      );

      // Remove associations
      if (projectsToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from("project_personas")
          .delete()
          .eq("persona_id", persona.id)
          .in("project_id", projectsToRemove);

        if (removeError) {
          toast({
            title: "Error",
            description: "Failed to remove some project associations",
            variant: "destructive",
          });
          return;
        }
      }

      // Add new associations
      if (projectsToAdd.length > 0) {
        const newAssociations = projectsToAdd.map((projectId) => ({
          project_id: projectId,
          persona_id: persona.id,
          created_by: user?.id,
        }));

        const { error: addError } = await supabase
          .from("project_personas")
          .insert(newAssociations);

        if (addError) {
          toast({
            title: "Error",
            description: "Failed to add some project associations",
            variant: "destructive",
          });
          return;
        }
      }

      toast({
        title: "Success",
        description: "Project associations updated successfully",
      });

      onUpdate?.();
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.spaceName &&
        project.spaceName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const hasChanges =
    selectedProjects.size !== initialSelectedProjects.size ||
    [...selectedProjects].some((id) => !initialSelectedProjects.has(id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Users2 className="w-5 h-5" />
            <span>Manage Projects for {persona.name}</span>
          </DialogTitle>
          <DialogDescription>
            Select which projects this persona should be associated with. This
            helps with targeted story generation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search projects..."
              variant="workspace"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Project List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">
                Loading projects...
              </span>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-8">
              <FolderKanban className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {searchTerm ? "No projects found" : "No projects available"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm
                  ? "Try adjusting your search terms"
                  : "Create projects in your workspace first"}
              </p>
            </div>
          ) : (
            <ScrollArea className="flex-1 -mx-1 px-1">
              <div className="space-y-2">
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedProjects.has(project.id)
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    onClick={() => handleToggleProject(project.id)}
                  >
                    <Checkbox
                      checked={selectedProjects.has(project.id)}
                      onCheckedChange={() => handleToggleProject(project.id)}
                      className="mr-3"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <FolderKanban className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium truncate">
                          {project.name}
                        </span>
                      </div>
                      {project.spaceName && (
                        <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                          in {project.spaceName}
                        </p>
                      )}
                    </div>
                    {selectedProjects.has(project.id) && (
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Selected Count */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm text-muted-foreground">
              <Badge variant="secondary" className="mr-2">
                {selectedProjects.size}
              </Badge>
              project{selectedProjects.size !== 1 ? "s" : ""} selected
            </div>
            {hasChanges && (
              <Badge
                variant="outline"
                className="text-amber-600 border-amber-200 bg-amber-50"
              >
                Unsaved changes
              </Badge>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="workspace"
            disabled={saving || !hasChanges}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
