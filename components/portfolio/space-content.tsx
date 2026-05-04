"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectsSection } from "@/components/portfolio/projects-section";
import CreateProjectModal from "@/components/workspace/modals/create-project-modal";
import CreateSprintFolderModal from "@/components/workspace/modals/create-sprint-folder-modal";
import type { Workspace, Space, Project } from "@/lib/database-aliases";

// Database row types (without nested relations) — permissive to accept extra DB columns
interface WorkspaceRow {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  owner_id: string;
  purpose: string;
  type: string;
  category: string;
  [key: string]: unknown;
}

interface SpaceRow {
  id: string;
  space_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_private: boolean | null;
  workspace_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  [key: string]: unknown;
}

interface ProjectRow {
  id: string;
  project_id: string;
  name: string;
  space_id: string | null;
  workspace_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  type: string | null;
  deleted_at: string | null;
  [key: string]: unknown;
}

interface SprintFolderRow {
  id: string;
  sprint_folder_id: string;
  name: string;
  project_id?: string | null;
  sprints?: any[];
}

interface SpaceContentProps {
  workspace: WorkspaceRow;
  space: SpaceRow;
  projects: ProjectRow[];
  sprintFolders: SprintFolderRow[];
  workspaceId: string;
  spaceId: string;
}

export function SpaceContent({
  workspace,
  space,
  projects: initialProjects,
  sprintFolders,
  workspaceId,
  spaceId,
}: SpaceContentProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[]>(initialProjects);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSprintFolderOpen, setCreateSprintFolderOpen] = useState(false);
  const [selectedProjectForFolder, setSelectedProjectForFolder] = useState<string | null>(null);

  // Handler for creating sprint folder from within a project
  const handleCreateSprintFolder = (projectId: string) => {
    setSelectedProjectForFolder(projectId);
    setCreateSprintFolderOpen(true);
  };

  // Create the spaces array format required by CreateProjectModal
  // Cast to the expected types since we're providing the required fields
  const spacesWithProjects = [
    {
      ...space,
      projects: projects as unknown as Project[],
    },
  ] as (Space & { projects: Project[] })[];

  const workspaceForModal = {
    ...workspace,
    spaces: [],
  } as unknown as Workspace;

  const spacesForSprintFolders = [space] as unknown as Space[];

  const handleProjectCreated = (newProject: Project) => {
    // Cast to ProjectRow for local state
    setProjects((prev) => [newProject as unknown as ProjectRow, ...prev]);
  };

  const handleProjectDeleted = () => {
    // Refresh the page to get updated project list
    router.refresh();
  };

  const handleSprintFolderCreated = (newFolder: any) => {
    setCreateSprintFolderOpen(false);
    setSelectedProjectForFolder(null);
    router.push(`/${workspaceId}/space/${spaceId}/sf/${newFolder.sprint_folder_id}`);
  };

  const hasProjects = projects && projects.length > 0;
  const isEmpty = !hasProjects;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{space.name}</h1>
          {space.description && (
            <p className="text-muted-foreground mt-1">{space.description}</p>
          )}
        </div>
        <Button
          variant="workspace"
          size="sm"
          onClick={() => setCreateModalOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          New Project
        </Button>
      </div>

      {/* Projects Section - Sprint Folders are nested under each project */}
      {hasProjects && (
        <ProjectsSection
          projects={projects}
          sprintFolders={sprintFolders}
          workspaceId={workspaceId}
          spaceId={spaceId}
          onCreateProject={() => setCreateModalOpen(true)}
          onProjectDeleted={handleProjectDeleted}
          onCreateSprintFolder={handleCreateSprintFolder}
        />
      )}

      {/* Empty State */}
      {isEmpty && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <FolderKanban className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No projects yet</h3>
          <p className="text-muted-foreground mb-4">
            Create a project to start organizing your sprint folders and tasks.
          </p>
          <Button
            variant="workspace"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Create Project
          </Button>
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={handleProjectCreated}
        workspace={workspaceForModal}
        spaces={spacesWithProjects}
        selectedSpaceId={space.id}
      />

      <CreateSprintFolderModal
        open={createSprintFolderOpen}
        onOpenChange={(open) => {
          setCreateSprintFolderOpen(open);
          if (!open) setSelectedProjectForFolder(null);
        }}
        onSuccess={handleSprintFolderCreated}
        workspace={workspaceForModal}
        spaces={spacesForSprintFolders}
        selectedSpaceId={space.id}
        selectedProjectId={selectedProjectForFolder || undefined}
        projects={projects as unknown as Project[]}
      />
    </div>
  );
}
