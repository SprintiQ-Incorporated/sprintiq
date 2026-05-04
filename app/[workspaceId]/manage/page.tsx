"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  Layers,
  Folder,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Users,
  Loader2,
  Crown,
  Check,
} from "lucide-react";
import CreateWorkspaceModal from "@/components/workspace/modals/create-workspace-modal";
import CreateSpaceModal from "@/components/workspace/modals/create-space-modal";
import CreateProjectModal from "@/components/workspace/modals/create-project-modal";
import { csrfFetch } from "@/hooks/useCsrfFetch";
import type { Workspace, Space, Project } from "@/lib/database-aliases";
import { WORKSPACE_COLUMNS, SPACE_COLUMNS, PROJECT_COLUMNS } from "@/lib/query-columns";

interface WorkspaceWithStats {
  id: string;
  workspace_id: string;
  name: string;
  purpose: string;
  type: string;
  category: string;
  created_at: string;
  owner_id: string;
  memberCount: number;
  spacesCount: number;
  projectsCount: number;
  isOwner: boolean;
  isCurrent: boolean;
}

interface SpaceWithProjects {
  id: string;
  space_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_private: boolean;
  projectCount: number;
  memberCount: number;
  projects: ProjectWithStats[];
}

interface ProjectWithStats {
  id: string;
  project_id: string;
  name: string;
  type: string | null;
  space_id: string | null;
  taskCount: number;
  sprintCount: number;
  isActive: boolean;
}

export default function ManagePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const { user } = useAuth();
  const { toast } = useEnhancedToast();
  const supabase = createClientSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<WorkspaceWithStats | null>(null);
  const [spaces, setSpaces] = useState<SpaceWithProjects[]>([]);
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());

  // Modal states
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [createSpaceOpen, setCreateSpaceOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | undefined>();

  // Edit/Delete states
  const [editSpaceOpen, setEditSpaceOpen] = useState(false);
  const [spaceToEdit, setSpaceToEdit] = useState<SpaceWithProjects | null>(null);
  const [editSpaceName, setEditSpaceName] = useState("");
  const [deleteSpaceOpen, setDeleteSpaceOpen] = useState(false);
  const [spaceToDelete, setSpaceToDelete] = useState<SpaceWithProjects | null>(null);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<ProjectWithStats | null>(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectWithStats | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rename Workspace state
  const [renameWorkspaceOpen, setRenameWorkspaceOpen] = useState(false);
  const [renameWorkspaceName, setRenameWorkspaceName] = useState("");

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get current workspace
      // Use maybeSingle() to avoid 406 when RLS denies access during token refresh
      const { data: workspaceData, error: workspaceError } = await supabase
        .from("workspaces")
        .select(WORKSPACE_COLUMNS.CORE)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .maybeSingle();

      if (workspaceError || !workspaceData) {
        toast({ title: "Error", description: "Workspace not found", variant: "destructive" });
        return;
      }

      // Get workspace stats
      const [spacesResult, projectsResult] = await Promise.all([
        supabase
          .from("spaces")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceData.id)
          .is("deleted_at", null),
        supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceData.id)
          .is("deleted_at", null),
      ]);

      // PHASE_5_NOOP: was multi-user team-member count, OSS is single-user
      const uniqueMemberCount = 1;

      setWorkspace({
        ...workspaceData,
        memberCount: uniqueMemberCount,
        spacesCount: spacesResult.count || 0,
        projectsCount: projectsResult.count || 0,
        isOwner: workspaceData.owner_id === user.id,
        isCurrent: true,
      } as WorkspaceWithStats);

      // Get spaces with projects
      const { data: spacesData } = await supabase
        .from("spaces")
        .select(SPACE_COLUMNS.CORE)
        .eq("workspace_id", workspaceData.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (spacesData) {
        // Batch fetch all data to avoid N+1 queries
        const allSpaceIds = spacesData.map((s) => s.id); // Only UUIDs for foreign key queries

        // Fetch all projects for all spaces in one query (space_id is UUID foreign key)
        const { data: allProjects } = await supabase
          .from("projects")
          .select(PROJECT_COLUMNS.CORE)
          .in("space_id", allSpaceIds)
          .is("deleted_at", null);

        const projectIds = (allProjects || []).map((p) => p.id);

        // Batch fetch task counts for all projects in one query
        const { data: taskCounts } = projectIds.length > 0
          ? await supabase
              .from("tasks")
              .select("project_id")
              .in("project_id", projectIds)
              .is("deleted_at", null)
          : { data: [] };

        // Create a map of project_id -> task count
        const taskCountMap = new Map<string, number>();
        (taskCounts || []).forEach((task) => {
          if (task.project_id) {
            taskCountMap.set(task.project_id, (taskCountMap.get(task.project_id) || 0) + 1);
          }
        });

        // Batch fetch sprint folders and sprints for all spaces
        const { data: sprintFolders } = allSpaceIds.length > 0
          ? await supabase
              .from("sprint_folders")
              .select("id, space_id")
              .in("space_id", allSpaceIds)
              .is("deleted_at", null)
          : { data: [] };

        const sprintFolderIds = (sprintFolders || []).map((sf) => sf.id);
        
        // Batch fetch sprints for all sprint folders
        const { data: sprints } = sprintFolderIds.length > 0
          ? await supabase
              .from("sprints")
              .select("id, sprint_folder_id")
              .in("sprint_folder_id", sprintFolderIds)
              .is("deleted_at", null)
          : { data: [] };

        // Create a map of space_id -> sprint count
        const sprintCountMap = new Map<string, number>();
        (sprintFolders || []).forEach((folder) => {
          if (folder.space_id) {
            const folderSprintCount = (sprints || []).filter(
              (s) => s.sprint_folder_id === folder.id
            ).length;
            sprintCountMap.set(
              folder.space_id,
              (sprintCountMap.get(folder.space_id) || 0) + folderSprintCount
            );
          }
        });

        // PHASE_5_NOOP: was multi-user space-member count, OSS is single-user
        const memberCountMap = new Map<string, number>();

        // Map data to spaces
        const spacesWithDetails = spacesData.map((space) => {
          // Get projects for this space (match by UUID or short ID)
          const spaceProjects = (allProjects || []).filter(
            (p) => p.space_id === space.id || p.space_id === space.space_id
          );

          // Add task and sprint counts to projects
          // Sprint count uses space.id since sprint_folders belong to spaces
          const projectsWithStats = spaceProjects.map((project) => ({
            ...project,
            taskCount: taskCountMap.get(project.id) || 0,
            sprintCount: sprintCountMap.get(space.id) || 0,
            isActive: (taskCountMap.get(project.id) || 0) > 0,
          }));

          // Get member count (check both UUID and short ID)
          const memberCount =
            (memberCountMap.get(space.id) || 0) +
            (space.id !== space.space_id ? memberCountMap.get(space.space_id) || 0 : 0);

          return {
            ...space,
            is_private: space.is_private || false,
            projectCount: spaceProjects.length,
            memberCount,
            projects: projectsWithStats,
          };
        });

        setSpaces(spacesWithDetails as SpaceWithProjects[]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, workspaceId]);

  const toggleSpace = (spaceId: string) => {
    setExpandedSpaces((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) {
        next.delete(spaceId);
      } else {
        next.add(spaceId);
      }
      return next;
    });
  };

  const openCreateProject = (spaceId?: string) => {
    setSelectedSpaceId(spaceId);
    setCreateProjectOpen(true);
  };

  // Space CRUD handlers
  const handleRenameWorkspace = async () => {
    if (!workspace || !renameWorkspaceName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await csrfFetch(`/api/workspace/${workspace.workspace_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameWorkspaceName.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to rename workspace");
      }
      toast({ title: "Success", description: "Workspace renamed successfully" });
      setRenameWorkspaceOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSpace = async () => {
    if (!spaceToEdit || !editSpaceName.trim()) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("spaces")
        .update({ name: editSpaceName.trim() })
        .eq("id", spaceToEdit.id);

      if (error) throw error;

      toast({ title: "Success", description: "Portfolio renamed successfully" });
      setEditSpaceOpen(false);
      setSpaceToEdit(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSpace = async () => {
    if (!spaceToDelete) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("spaces")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", spaceToDelete.id);

      if (error) throw error;

      toast({ title: "Success", description: "Portfolio deleted successfully" });
      setDeleteSpaceOpen(false);
      setSpaceToDelete(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Project CRUD handlers
  const handleEditProject = async () => {
    if (!projectToEdit || !editProjectName.trim()) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ name: editProjectName.trim() })
        .eq("id", projectToEdit.id);

      if (error) throw error;

      toast({ title: "Success", description: "Project renamed successfully" });
      setEditProjectOpen(false);
      setProjectToEdit(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", projectToDelete.id);

      if (error) throw error;

      // Emit event to update sidebar navigation
      window.dispatchEvent(
        new CustomEvent("projectDeleted", {
          detail: { project: projectToDelete },
        })
      );

      toast({ title: "Success", description: "Project deleted successfully" });
      setDeleteProjectOpen(false);
      setProjectToDelete(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getIconColor = (icon: string | null) => {
    const colors: Record<string, string> = {
      blue: "bg-blue-500",
      green: "bg-green-500",
      red: "bg-red-500",
      purple: "bg-purple-500",
      yellow: "bg-yellow-500",
      pink: "bg-pink-500",
    };
    return colors[icon || "blue"] || "bg-blue-500";
  };

  if (loading) {
    return null;
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div id="manage-header">
        <h1 className="text-xl sm:text-2xl font-bold">Workspace Management</h1>
        <p className="text-sm text-muted-foreground">
          Manage your workspaces, portfolios, and projects
        </p>
      </div>

      {/* Current Workspace */}
      {workspace && (
        <div id="manage-current-workspace" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Current Workspace
            </h2>
            <Button id="manage-new-workspace" variant="outline" size="sm" onClick={() => setCreateWorkspaceOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" />
              New Workspace
            </Button>
          </div>
          <Card className="workspace-header-bg border workspace-border">
            <CardContent className="pt-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg workspace-component-bg flex items-center justify-center text-base sm:text-lg font-bold text-workspace-primary flex-shrink-0">
                    {workspace.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-base sm:text-lg truncate">{workspace.name}</h3>
                      {workspace.isOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          title="Rename workspace"
                          onClick={() => {
                            setRenameWorkspaceName(workspace.name);
                            setRenameWorkspaceOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {workspace.isOwner && (
                        <Badge variant="workspace" className="text-xs flex-shrink-0">
                          <Crown className="h-3 w-3 mr-1" />
                          Owner
                        </Badge>
                      )}
                      <Badge variant="workspaceSecondary" className="text-xs flex-shrink-0">
                        <Check className="h-3 w-3 mr-1" />
                        Current
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground capitalize">
                      {workspace.purpose} • {workspace.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-around sm:justify-end gap-4 sm:gap-6 text-center pt-3 lg:pt-0 border-t lg:border-t-0 workspace-border">
                  <div>
                    <div className="text-lg sm:text-xl font-bold">{workspace.memberCount}</div>
                    <div className="text-xs text-muted-foreground">Members</div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-bold text-blue-500">{workspace.spacesCount}</div>
                    <div className="text-xs text-muted-foreground">Portfolios</div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-xl font-bold text-green-500">{workspace.projectsCount}</div>
                    <div className="text-xs text-muted-foreground">Projects</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Portfolios & Projects */}
      <div id="manage-portfolios-section" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-500" />
            Portfolios & Projects
          </h2>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button id="manage-new-portfolio" variant="outline" size="sm" onClick={() => setCreateSpaceOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" />
              New Portfolio
            </Button>
            <Button id="manage-new-project" variant="workspace" size="sm" onClick={() => openCreateProject()} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" />
              New Project
            </Button>
          </div>
        </div>

        {spaces.length === 0 ? (
          <Card className="p-8 text-center workspace-header-bg border workspace-border">
            <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No portfolios yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first portfolio to organize your projects
            </p>
            <Button variant="workspace" onClick={() => setCreateSpaceOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Portfolio
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {spaces.map((space) => (
              <Card
                key={space.id}
                className="workspace-header-bg border workspace-border overflow-hidden"
              >
                {/* Space Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => toggleSpace(space.id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedSpaces.has(space.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm ${getIconColor(
                        space.icon
                      )}`}
                    >
                      {space.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{space.name}</h3>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title="Rename portfolio"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSpaceToEdit(space);
                            setEditSpaceName(space.name);
                            setEditSpaceOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {space.is_private && (
                          <Badge variant="outline" className="text-xs">
                            Private
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {space.projectCount} projects • {space.memberCount} members
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => openCreateProject(space.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Project
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      title="Delete portfolio"
                      onClick={() => {
                        setSpaceToDelete(space);
                        setDeleteSpaceOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Projects List */}
                {expandedSpaces.has(space.id) && (
                  <div className="border-t border-white/10 bg-black/10">
                    {space.projects.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No projects in this portfolio
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {space.projects.map((project) => (
                          <div
                            key={project.id}
                            className="flex items-center justify-between p-3 pl-12 hover:bg-white/5 transition-colors cursor-pointer"
                            onClick={() =>
                              router.push(
                                `/${workspaceId}/space/${space.space_id}/project/${project.project_id}`
                              )
                            }
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                router.push(
                                  `/${workspaceId}/space/${space.space_id}/project/${project.project_id}`
                                );
                              }
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <Folder className="h-4 w-4 text-blue-400" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{project.name}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    title="Rename project"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProjectToEdit(project);
                                      setEditProjectName(project.name);
                                      setEditProjectOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  {project.isActive && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs text-green-500 border-green-500/30"
                                    >
                                      Active
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {project.taskCount} stories • {project.sprintCount} sprints
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-600"
                              title="Delete project"
                              onClick={(e) => {
                                e.stopPropagation();
                                setProjectToDelete(project);
                                setDeleteProjectOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateWorkspaceModal
        isCreateModalOpen={createWorkspaceOpen}
        setIsCreateModalOpen={setCreateWorkspaceOpen}
      />

      {workspace && (
        <>
          <CreateSpaceModal
            open={createSpaceOpen}
            onOpenChange={setCreateSpaceOpen}
            onSuccess={() => fetchData()}
            workspace={workspace as unknown as Workspace}
          />

          <CreateProjectModal
            open={createProjectOpen}
            onOpenChange={setCreateProjectOpen}
            onSuccess={() => fetchData()}
            workspace={workspace as unknown as Workspace}
            spaces={spaces as unknown as (Space & { projects: Project[] })[]}
            selectedSpaceId={selectedSpaceId}
          />
        </>
      )}

      {/* Rename Workspace Dialog (owner-only) */}
      <AlertDialog open={renameWorkspaceOpen} onOpenChange={setRenameWorkspaceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Workspace</AlertDialogTitle>
            <AlertDialogDescription>Enter a new name for this workspace.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              value={renameWorkspaceName}
              onChange={(e) => setRenameWorkspaceName(e.target.value)}
              placeholder="Workspace name"
              maxLength={255}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRenameWorkspace} disabled={isSubmitting || !renameWorkspaceName.trim()}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Space Dialog */}
      <AlertDialog open={editSpaceOpen} onOpenChange={setEditSpaceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Portfolio</AlertDialogTitle>
            <AlertDialogDescription>Enter a new name for this portfolio.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              value={editSpaceName}
              onChange={(e) => setEditSpaceName(e.target.value)}
              placeholder="Portfolio name"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEditSpace} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Space Dialog */}
      <AlertDialog open={deleteSpaceOpen} onOpenChange={setDeleteSpaceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Portfolio</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{spaceToDelete?.name}&quot;? This will also
              delete all projects and data within this portfolio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSpace}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Project Dialog */}
      <AlertDialog open={editProjectOpen} onOpenChange={setEditProjectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Project</AlertDialogTitle>
            <AlertDialogDescription>Enter a new name for this project.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              value={editProjectName}
              onChange={(e) => setEditProjectName(e.target.value)}
              placeholder="Project name"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEditProject} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Project Dialog */}
      <AlertDialog open={deleteProjectOpen} onOpenChange={setDeleteProjectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{projectToDelete?.name}&quot;? This will also
              delete all tasks and data within this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
