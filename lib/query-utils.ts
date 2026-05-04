/**
 * Query Invalidation Utilities
 * Centralized functions for invalidating React Query caches after mutations
 * to replace window.location.reload() anti-pattern
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Query keys used across the application
 * Keep in sync with lib/hooks/use-query-hooks.ts
 */
export const queryKeys = {
  // Sprint-related keys
  sprints: (workspaceId: string) => ['sprints', workspaceId] as const,
  sprint: (sprintId: string) => ['sprint', sprintId] as const,
  sprintData: (sprintId: string, workspaceId: string) =>
    ['sprint', sprintId, 'data', workspaceId] as const,
  sprintFolders: (spaceId: string) => ['sprint-folders', spaceId] as const,
  sprintFolder: (sprintFolderId: string) => ['sprint-folder', sprintFolderId] as const,

  // Task-related keys
  tasks: (workspaceId: string) => ['tasks', workspaceId] as const,
  tasksBySprint: (sprintId: string) => ['tasks', 'sprint', sprintId] as const,
  tasksByProject: (projectId: string) => ['tasks', 'project', projectId] as const,

  // Project-related keys
  projects: (workspaceId: string) => ['projects', workspaceId] as const,
  project: (projectId: string) => ['project', projectId] as const,
  projectData: (projectId: string, workspaceId: string) =>
    ['project', projectId, 'data', workspaceId] as const,

  // Workspace-related keys
  workspace: (workspaceId: string) => ['workspace', workspaceId] as const,
  workspaceUsage: (workspaceId: string) => ['workspace-usage', workspaceId] as const,

  // Space-related keys
  spaces: (workspaceId: string) => ['spaces', workspaceId] as const,
  space: (spaceId: string) => ['space', spaceId] as const,
} as const;

/**
 * Invalidate all sprint-related queries after sprint mutations
 * Use after: sprint creation, sprint rename, sprint delete
 */
export async function invalidateSprintQueries(
  queryClient: QueryClient,
  workspaceId: string,
  options?: {
    spaceId?: string;
    sprintFolderId?: string;
    sprintId?: string;
  }
): Promise<void> {
  const invalidations: Promise<void>[] = [
    // Always invalidate workspace sprints list
    queryClient.invalidateQueries({ queryKey: queryKeys.sprints(workspaceId) }),
  ];

  // Invalidate sprint folder if specified
  if (options?.spaceId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.sprintFolders(options.spaceId) })
    );
  }

  // Invalidate specific sprint folder
  if (options?.sprintFolderId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.sprintFolder(options.sprintFolderId) })
    );
  }

  // Invalidate specific sprint data
  if (options?.sprintId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.sprint(options.sprintId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sprintData(options.sprintId, workspaceId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksBySprint(options.sprintId) })
    );
  }

  await Promise.all(invalidations);
}

/**
 * Invalidate all sprint folder-related queries after folder mutations
 * Use after: folder creation, folder rename, folder delete, folder move
 */
export async function invalidateSprintFolderQueries(
  queryClient: QueryClient,
  workspaceId: string,
  spaceId: string,
  options?: {
    sprintFolderId?: string;
    targetSpaceId?: string; // For move operations
  }
): Promise<void> {
  const invalidations: Promise<void>[] = [
    queryClient.invalidateQueries({ queryKey: queryKeys.sprintFolders(spaceId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.spaces(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.space(spaceId) }),
  ];

  // Invalidate specific sprint folder
  if (options?.sprintFolderId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.sprintFolder(options.sprintFolderId) })
    );
  }

  // For move operations, also invalidate target space
  if (options?.targetSpaceId && options.targetSpaceId !== spaceId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.sprintFolders(options.targetSpaceId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.space(options.targetSpaceId) })
    );
  }

  await Promise.all(invalidations);
}

/**
 * Invalidate all task-related queries after task mutations
 * Use after: task creation, task update, task delete, bulk task operations
 */
export async function invalidateTaskQueries(
  queryClient: QueryClient,
  workspaceId: string,
  options?: {
    sprintId?: string;
    projectId?: string;
  }
): Promise<void> {
  const invalidations: Promise<void>[] = [
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks(workspaceId) }),
  ];

  if (options?.sprintId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksBySprint(options.sprintId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sprintData(options.sprintId, workspaceId) })
    );
  }

  if (options?.projectId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksByProject(options.projectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projectData(options.projectId, workspaceId) })
    );
  }

  await Promise.all(invalidations);
}

/**
 * Invalidate all project-related queries after project mutations
 * Use after: project update, sync, bulk imports
 */
export async function invalidateProjectQueries(
  queryClient: QueryClient,
  workspaceId: string,
  options?: {
    projectId?: string;
    spaceId?: string;
  }
): Promise<void> {
  const invalidations: Promise<void>[] = [
    queryClient.invalidateQueries({ queryKey: queryKeys.projects(workspaceId) }),
  ];

  if (options?.projectId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.project(options.projectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projectData(options.projectId, workspaceId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tasksByProject(options.projectId) })
    );
  }

  if (options?.spaceId) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.space(options.spaceId) })
    );
  }

  await Promise.all(invalidations);
}

