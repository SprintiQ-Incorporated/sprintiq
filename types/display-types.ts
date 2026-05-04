/**
 * Display Types
 *
 * These types are designed to match what queries actually return, not what extended types define.
 * Use these types when components receive data from database queries that only select base columns
 * without nested relations.
 *
 * The pattern solves the systemic mismatch where:
 * - Extended types define: Space & { projects: Project[]; sprint_folders: SprintFolder[] }
 * - Queries return: Space (base only, no nested relations)
 * - Components expect the full type -> TypeScript errors / runtime undefined access
 *
 * USAGE:
 * - Use *Base types when queries select only base columns (no nested relations)
 * - Use *WithRelations types when queries include .select('*, relation(*)')
 * - Use *Display types to exclude sensitive fields (tokens, passwords, etc.)
 */

import type { Database } from '@/lib/database-aliases';

// =============================================================================
// Base Row Types (directly from database, no extensions)
// =============================================================================

/** Base Space type matching database row - no nested relations */
export type SpaceBase = Database['public']['Tables']['spaces']['Row'];

/** Base Project type matching database row - no nested relations */
export type ProjectBase = Database['public']['Tables']['projects']['Row'];

/** Base Sprint type matching database row - no nested relations */
export type SprintBase = Database['public']['Tables']['sprints']['Row'];

/** Base SprintFolder type matching database row - no nested relations */
export type SprintFolderBase = Database['public']['Tables']['sprint_folders']['Row'];

/** Base Task type matching database row - no nested relations */
export type TaskBase = Database['public']['Tables']['tasks']['Row'];

/** Base Day type matching database row */
export type DayBase = Database['public']['Tables']['days']['Row'];

/** Base Workspace type matching database row */
export type WorkspaceBase = Database['public']['Tables']['workspaces']['Row'];

/** Base Profile type matching database row */
export type ProfileBase = Database['public']['Tables']['profiles']['Row'];

// =============================================================================
// Display Types (exclude sensitive fields)
// =============================================================================

/**
 * Day display type for UI components that only need id and name.
 * Use for dropdowns, selectors, etc.
 */
export type DayDisplay = Pick<DayBase, 'id' | 'name'>;

// =============================================================================
// Types with Optional Relations
// =============================================================================

/**
 * Space with optional nested relations.
 * Use when the query may or may not include related data.
 */
export type SpaceWithOptionalRelations = SpaceBase & {
  projects?: ProjectBase[];
  sprint_folders?: SprintFolderBase[];
};

/**
 * Space with required nested relations.
 * Use when the query explicitly includes .select('*, projects(*), sprint_folders(*)').
 */
export type SpaceWithRelations = SpaceBase & {
  projects: ProjectBase[];
  sprint_folders: SprintFolderBase[];
};

/**
 * Project with optional nested relations.
 */
export type ProjectWithOptionalRelations = ProjectBase & {
  tasks?: TaskBase[];
};

/**
 * Project with required tasks relation.
 * Use when the query explicitly includes .select('*, tasks(*)').
 */
export type ProjectWithTasks = ProjectBase & {
  tasks: TaskBase[];
};

/**
 * Sprint with optional nested relations.
 */
export type SprintWithOptionalRelations = SprintBase & {
  tasks?: TaskBase[];
  sprint_folder?: SprintFolderBase;
};

/**
 * Sprint with required tasks relation.
 * Use when the query explicitly includes tasks.
 */
export type SprintWithTasks = SprintBase & {
  tasks: TaskBase[];
};

/**
 * SprintFolder with optional nested relations.
 */
export type SprintFolderWithOptionalRelations = SprintFolderBase & {
  sprints?: SprintBase[];
  sprint_start_day?: DayBase;
};

/**
 * SprintFolder with required sprints relation.
 */
export type SprintFolderWithSprints = SprintFolderBase & {
  sprints: SprintBase[];
  sprint_start_day?: DayBase;
};

/**
 * SprintFolder with sprints that have tasks loaded.
 */
export type SprintFolderWithSprintsAndTasks = SprintFolderBase & {
  sprints: SprintWithOptionalRelations[];
  sprint_start_day?: DayBase;
};

// =============================================================================
// Workspace Types
// =============================================================================

/**
 * Workspace with optional spaces relation.
 */
export type WorkspaceWithOptionalRelations = WorkspaceBase & {
  spaces?: SpaceBase[];
};

/**
 * Workspace with required spaces relation.
 */
export type WorkspaceWithSpaces = WorkspaceBase & {
  spaces: SpaceBase[];
};

// =============================================================================
// Callback/Handler Types
// =============================================================================

/**
 * Type for space creation callbacks.
 * Space creation returns base data without nested relations.
 */
export type OnSpaceCreatedCallback = (space: SpaceBase) => void;

/**
 * Type for space creation callbacks when relations are included.
 */
export type OnSpaceCreatedWithRelationsCallback = (
  space: SpaceWithRelations
) => void;

/**
 * Type for project creation callbacks.
 */
export type OnProjectCreatedCallback = (project: ProjectBase) => void;

/**
 * Type for sprint folder creation callbacks.
 */
export type OnSprintFolderCreatedCallback = (
  sprintFolder: SprintFolderBase
) => void;

/**
 * Type for sprint creation callbacks.
 */
export type OnSprintCreatedCallback = (sprint: SprintBase) => void;

// =============================================================================
// Re-exports for convenience
// =============================================================================

// Re-export base types that are commonly used
export type {
  Database,
} from '@/lib/database-aliases';
