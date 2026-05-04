/**
 * Sidebar Helper Functions
 * Pure utility functions for sidebar operations.
 */
import type {
  ProjectBase,
  SprintFolderBase,
  SprintBase,
  SpaceWithSidebarRelations,
} from "../types";

/** Check if a project is Azure DevOps integrated */
export function isAzureProject(project: ProjectBase): boolean {
  return project.type === "azure";
}

/** Sort items alphabetically by name */
export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

/** Filter out deleted items from a list */
export function filterDeleted<T extends { deleted_at: string | null }>(items: T[]): T[] {
  return items.filter((item) => !item.deleted_at);
}

/** Get active (non-deleted) projects for a space */
export function getActiveProjects(space: SpaceWithSidebarRelations): ProjectBase[] {
  return filterDeleted(space.projects);
}

/** Get active (non-deleted) sprint folders for a space */
export function getActiveSprintFolders(
  space: SpaceWithSidebarRelations
): (SprintFolderBase & { sprints: SprintBase[] })[] {
  return filterDeleted(space.sprint_folders);
}

/** Get active (non-deleted, non-completed) sprints for a sprint folder */
export function getActiveSprints(
  folder: SprintFolderBase & { sprints: SprintBase[] }
): SprintBase[] {
  return filterDeleted(folder.sprints).filter(
    (sprint) => sprint.status !== "completed"
  );
}

/** Get completed (non-deleted, completed status) sprints for a sprint folder */
export function getCompletedSprints(
  folder: SprintFolderBase & { sprints: SprintBase[] }
): SprintBase[] {
  return filterDeleted(folder.sprints).filter(
    (sprint) => sprint.status === "completed"
  );
}

/** Build localStorage key for favorites by entity type */
export function getFavoritesKey(
  workspaceId: string,
  entityType: "space" | "project" | "sprint-folder" | "sprint"
): string {
  const keyMap = {
    space: "favorites",
    project: "project_favorites",
    "sprint-folder": "sprint_folder_favorites",
    sprint: "sprint_favorites",
  };
  return `${keyMap[entityType]}_${workspaceId}`;
}
