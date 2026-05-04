"use client";

import { useState } from "react";
import Link from "next/link";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Folder,
  FolderKanban,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Edit,
  Loader2,
  Trash2,
  Plus,
  Layers,
} from "lucide-react";

interface Project {
  id: string;
  project_id: string;
  name: string;
  type?: string | null;
}

interface SprintFolder {
  id: string;
  sprint_folder_id: string;
  name: string;
  project_id?: string | null;
  sprints?: any[];
}

interface ProjectsSectionProps {
  projects: Project[];
  sprintFolders?: SprintFolder[];
  workspaceId: string;
  spaceId: string;
  onCreateProject?: () => void;
  onProjectDeleted?: () => void;
  onCreateSprintFolder?: (projectId: string) => void;
}

export function ProjectsSection({
  projects: initialProjects,
  sprintFolders = [],
  workspaceId,
  spaceId,
  onCreateProject,
  onProjectDeleted,
  onCreateSprintFolder,
}: ProjectsSectionProps) {
  const supabase = createClientSupabaseClient();
  const { toast } = useEnhancedToast();

  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [projectToRename, setProjectToRename] = useState<Project | null>(null);

  // Get sprint folders for a specific project
  const getProjectSprintFolders = (projectId: string) => {
    return sprintFolders.filter(
      (folder) => folder.project_id === projectId && (folder.sprints?.length || 0) > 0
    );
  };

  // Toggle project expansion
  const toggleProjectExpansion = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };
  const [newProjectName, setNewProjectName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openRenameDialog = (project: Project) => {
    setProjectToRename(project);
    setNewProjectName(project.name);
    setRenameDialogOpen(true);
  };

  const renameProject = async () => {
    if (!projectToRename || !newProjectName.trim()) return;

    setIsRenaming(true);

    try {
      const { error } = await supabase
        .from("projects")
        .update({ name: newProjectName.trim() })
        .eq("id", projectToRename.id);

      if (error) throw error;

      // Update local state
      setProjects((prev) =>
        prev.map((project) =>
          project.id === projectToRename.id
            ? { ...project, name: newProjectName.trim() }
            : project
        )
      );

      toast({
        title: "Project renamed",
        description: `Project has been renamed to "${newProjectName.trim()}".`,
        browserNotificationTitle: "Project renamed",
        browserNotificationBody: `Project has been renamed to "${newProjectName.trim()}".`,
      });

      setRenameDialogOpen(false);
      setProjectToRename(null);
      setNewProjectName("");
    } catch (error: any) {
      console.error("Error renaming project:", error);
      toast({
        title: "Error renaming project",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsRenaming(false);
    }
  };

  const openDeleteDialog = (project: Project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const deleteProject = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);

    try {
      // Soft delete by setting deleted_at
      const { error } = await supabase
        .from("projects")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", projectToDelete.id);

      if (error) throw error;

      // Update local state
      setProjects((prev) =>
        prev.filter((project) => project.id !== projectToDelete.id)
      );

      toast({
        title: "Project deleted",
        description: `"${projectToDelete.name}" has been deleted.`,
        browserNotificationTitle: "Project deleted",
        browserNotificationBody: `"${projectToDelete.name}" has been deleted.`,
      });

      setDeleteDialogOpen(false);
      setProjectToDelete(null);

      // Emit event to update sidebar navigation
      window.dispatchEvent(
        new CustomEvent("projectDeleted", {
          detail: { project: projectToDelete },
        })
      );

      // Notify parent for refresh
      onProjectDeleted?.();
    } catch (error: any) {
      console.error("Error deleting project:", error);
      toast({
        title: "Error deleting project",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!projects || projects.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Folder className="h-5 w-5 text-blue-500" />
          Projects
        </h2>
        {onCreateProject && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateProject}
            className="h-8"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Project
          </Button>
        )}
      </div>
      <div className="space-y-3">
        {projects.map((project) => {
          const projectFolders = getProjectSprintFolders(project.id);
          const isExpanded = expandedProjects.has(project.id);

          return (
            <div
              key={project.id}
              className="rounded-lg border workspace-border workspace-header-bg overflow-hidden"
            >
              {/* Project Header */}
              <div className="group relative p-4 hover:workspace-hover transition-all duration-200">
                <div className="flex items-center gap-2">
                  {/* Expand/Collapse Button */}
                  <button
                    onClick={(e) => toggleProjectExpansion(project.id, e)}
                    className="p-1 rounded hover:bg-muted/50 transition-colors"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  <Link
                    href={`/${workspaceId}/space/${spaceId}/project/${project.project_id}`}
                    className="flex-1 flex items-center gap-3 min-w-0"
                  >
                    <div className="p-2 rounded-lg bg-blue-500/10 flex-shrink-0">
                      <Folder className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium group-hover:text-blue-500 transition-colors truncate">
                        {project.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {projectFolders.length} sprint folder{projectFolders.length !== 1 ? "s" : ""}
                        {project.type && ` · ${project.type}`}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-500 transition-colors flex-shrink-0" />
                  </Link>

                  {/* Dropdown Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.preventDefault()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onCreateSprintFolder && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onCreateSprintFolder(project.id);
                          }}
                        >
                          <Layers className="h-4 w-4" />
                          Add Sprint Folder
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openRenameDialog(project);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                        Rename Project
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openDeleteDialog(project);
                        }}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Sprint Folders - Nested under project */}
              {isExpanded && (
                <div className="border-t workspace-border bg-muted/30">
                  {projectFolders.length > 0 ? (
                    <div className="p-3 space-y-2">
                      {projectFolders.map((folder) => (
                        <Link
                          key={folder.id}
                          href={`/${workspaceId}/space/${spaceId}/sf/${folder.sprint_folder_id}`}
                          className="group/folder flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="p-1.5 rounded-lg bg-emerald-500/10">
                            <FolderKanban className="h-4 w-4 text-emerald-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium group-hover/folder:text-emerald-500 transition-colors truncate">
                              {folder.name}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {folder.sprints?.length || 0} sprint{(folder.sprints?.length || 0) !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover/folder:text-emerald-500 transition-colors" />
                        </Link>
                      ))}
                      {onCreateSprintFolder && (
                        <button
                          onClick={() => onCreateSprintFolder(project.id)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed workspace-border hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="h-4 w-4" />
                          <span className="text-sm">Add Sprint Folder</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 text-center">
                      <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <FolderKanban className="h-5 w-5 text-emerald-500" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        No sprint folders in this project
                      </p>
                      {onCreateSprintFolder && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onCreateSprintFolder(project.id)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Create Sprint Folder
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Rename Project Dialog */}
      <AlertDialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Project</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a new name for this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              className="workspace-header-bg border workspace-border"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  renameProject();
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="text-xs"
              onClick={() => {
                setProjectToRename(null);
                setNewProjectName("");
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={renameProject}
              className="text-xs"
              disabled={
                isRenaming ||
                !newProjectName.trim() ||
                newProjectName.trim() === projectToRename?.name
              }
            >
              {isRenaming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Renaming...
                </>
              ) : (
                "Rename"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Project Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{projectToDelete?.name}&quot;? This will also delete all tasks and data within this project. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="text-xs"
              onClick={() => {
                setProjectToDelete(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteProject}
              className="text-xs bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete Project"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
