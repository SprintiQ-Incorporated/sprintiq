/**
 * Secondary Sidebar Types
 * Re-exports base types and defines sidebar-specific interfaces.
 */
import type {
  WorkspaceBase,
  SpaceBase,
  ProjectBase,
  SprintFolderBase,
  SprintBase,
} from "@/types/display-types";

// Re-export base types
export type { WorkspaceBase, SpaceBase, ProjectBase, SprintFolderBase, SprintBase };
export type { Status, Space, Project, SprintFolder, Sprint } from "@/lib/database-aliases";
export type { CascadeDeleteResult } from "@/lib/services/spaceService";

/** Space with nested relations for sidebar navigation */
export type SpaceWithSidebarRelations = SpaceBase & {
  projects: ProjectBase[];
  sprint_folders: (SprintFolderBase & { sprints: SprintBase[] })[];
};

/** Props for the main SecondarySidebar component */
export interface SecondarySidebarProps {
  workspace: WorkspaceBase;
  spaces: SpaceWithSidebarRelations[];
}

/** Entity type discriminator for CRUD operations */
export type SidebarEntityType = "space" | "project" | "sprint-folder" | "sprint";

/** Target for rename dialog */
export interface RenameTarget {
  type: SidebarEntityType;
  id: string;
  currentName: string;
}

/** Target for delete confirmation dialog */
export interface DeleteTarget {
  type: SidebarEntityType;
  id: string;
  name: string;
}

/** Modal open/close state */
export interface CreateModalState {
  space: boolean;
  project: boolean;
  task: boolean;
  sprintFolder: boolean;
  sprint: boolean;
}

/** Selection context for create operations */
export interface CreateSelectionContext {
  spaceIdForProject: string;
  spaceIdForSprintFolder: string;
  projectForTask: { project: ProjectBase; space: SpaceBase } | null;
  sprintFolderForSprint: { sprintFolder: SprintFolderBase; space: SpaceBase } | null;
  sprintForTask: { sprint: SprintBase; space: SpaceBase } | null;
}

/** Favorites state by entity type */
export interface FavoritesState {
  spaces: Set<string>;
  projects: Set<string>;
  sprintFolders: Set<string>;
  sprints: Set<string>;
}

/** Expansion state for collapsible tree nodes */
export interface ExpansionState {
  spaces: Set<string>;
  sprintFolders: Set<string>;
}

/** Loading state for delete operations */
export interface DeletingState {
  space: boolean;
  project: boolean;
  sprintFolder: boolean;
  sprint: boolean;
}

/** Handlers passed to sidebar sub-components */
export interface SidebarHandlers {
  onToggleSpace: (spaceId: string) => void;
  onToggleSprintFolder: (folderId: string) => void;
  onCreateSpace: () => void;
  onCreateProject: (spaceId: string) => void;
  onCreateSprintFolder: (spaceId: string) => void;
  onCreateSprint: (sprintFolder: SprintFolderBase, space: SpaceBase) => void;
  onCreateTask: (ctx: { project?: ProjectBase; sprint?: SprintBase; space: SpaceBase }) => void;
  onRename: (target: RenameTarget) => void;
  onDelete: (target: DeleteTarget) => void;
  onCopyLink: (type: SidebarEntityType, id: string) => void;
  onToggleFavorite: (type: SidebarEntityType, id: string) => void;
}
