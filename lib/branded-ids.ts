// Branded types prevent mixing UUID and Short IDs at compile time

// Brand type helper
declare const brand: unique symbol;
type Brand<T, TBrand extends string> = T & { [brand]: TBrand };

// ============================================
// BRANDED ID TYPES
// ============================================

/** UUID primary key (e.g., "caccc78d-2e82-4fc8-98c3-62fe302a957d") */
export type UUID = Brand<string, "UUID">;

/** Workspace short ID (e.g., "w027293317360") */
export type WorkspaceShortId = Brand<string, "WorkspaceShortId">;

/** Space short ID (e.g., "sp_caccc78d") */
export type SpaceShortId = Brand<string, "SpaceShortId">;

/** Project short ID (e.g., "proj_0b8233f6") */
export type ProjectShortId = Brand<string, "ProjectShortId">;

/** Sprint Folder short ID (e.g., "sf_8fb2337b") */
export type SprintFolderShortId = Brand<string, "SprintFolderShortId">;

/** Sprint short ID (e.g., "s_696a5214") */
export type SprintShortId = Brand<string, "SprintShortId">;

/** Task short ID (e.g., "t_abc12345") */
export type TaskShortId = Brand<string, "TaskShortId">;

// ============================================
// TYPE GUARDS & VALIDATORS
// ============================================

export const ID_PATTERNS = {
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  WORKSPACE: /^w\d{12}$/,
  SPACE: /^sp_[a-f0-9]{8}$/,
  PROJECT: /^proj_[a-f0-9]{8}$/,
  SPRINT_FOLDER: /^sf_[a-f0-9]{8}$/,
  SPRINT: /^s_[a-f0-9]{8}$/,
  TASK: /^t_[a-f0-9]{8}$/,
} as const;

export function isUUID(value: string): value is UUID {
  return ID_PATTERNS.UUID.test(value);
}

export function isWorkspaceShortId(value: string): value is WorkspaceShortId {
  return ID_PATTERNS.WORKSPACE.test(value);
}

export function isSpaceShortId(value: string): value is SpaceShortId {
  return ID_PATTERNS.SPACE.test(value);
}

export function isProjectShortId(value: string): value is ProjectShortId {
  return ID_PATTERNS.PROJECT.test(value);
}

export function isSprintFolderShortId(value: string): value is SprintFolderShortId {
  return ID_PATTERNS.SPRINT_FOLDER.test(value);
}

export function isSprintShortId(value: string): value is SprintShortId {
  return ID_PATTERNS.SPRINT.test(value);
}

export function isTaskShortId(value: string): value is TaskShortId {
  return ID_PATTERNS.TASK.test(value);
}

// ============================================
// ID GENERATORS
// ============================================

export function generateWorkspaceId(): WorkspaceShortId {
  const num = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
  return `w${num}` as WorkspaceShortId;
}

export function generateSpaceId(): SpaceShortId {
  return `sp_${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}` as SpaceShortId;
}

export function generateProjectId(): ProjectShortId {
  return `proj_${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}` as ProjectShortId;
}

export function generateSprintFolderId(): SprintFolderShortId {
  return `sf_${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}` as SprintFolderShortId;
}

export function generateSprintId(): SprintShortId {
  return `s_${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}` as SprintShortId;
}

export function generateTaskId(): TaskShortId {
  return `t_${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}` as TaskShortId;
}

// ============================================
// ASSERTION HELPERS (Runtime validation)
// ============================================

export function assertUUID(value: string, context?: string): asserts value is UUID {
  if (!isUUID(value)) {
    throw new Error(`Invalid UUID${context ? ` for ${context}` : ''}: ${value}`);
  }
}

export function assertSpaceShortId(value: string, context?: string): asserts value is SpaceShortId {
  if (!isSpaceShortId(value)) {
    throw new Error(`Invalid Space ID${context ? ` for ${context}` : ''}: ${value}. Expected format: sp_xxxxxxxx`);
  }
}

export function assertProjectShortId(value: string, context?: string): asserts value is ProjectShortId {
  if (!isProjectShortId(value)) {
    throw new Error(`Invalid Project ID${context ? ` for ${context}` : ''}: ${value}. Expected format: proj_xxxxxxxx`);
  }
}

// ============================================
// FOREIGN KEY HELPERS
// ============================================

/**
 * CRITICAL: Foreign key columns (space_id, project_id in child tables)
 * ALWAYS use UUID, not short IDs.
 * 
 * Use these helpers to make the intent clear:
 */

/** Use when querying by foreign key (UUID column) */
export function asForeignKey(uuid: UUID): string {
  return uuid;
}

/** Use when querying by URL parameter (short ID column) */
export function asUrlParam(shortId: string): string {
  return shortId;
}

// ============================================
// QUERY HELPERS
// ============================================

/**
 * Safe query builder that enforces correct column/value matching
 */
export const QueryHelpers = {
  /** Query spaces table by short ID (URL param) */
  spaceByShortId: (spaceId: string) => ({
    column: 'space_id' as const,
    value: spaceId,
    validate: () => {
      if (!isSpaceShortId(spaceId)) {
      }
    }
  }),
  
  /** Query child tables by space foreign key (UUID) */
  bySpaceForeignKey: (spaceUUID: string) => ({
    column: 'space_id' as const,
    value: spaceUUID,
    validate: () => {
      if (!isUUID(spaceUUID)) {
        throw new Error(`CRITICAL: space_id foreign key must be UUID, got: ${spaceUUID}`);
      }
    }
  }),
  
  /** Query projects table by short ID (URL param) */
  projectByShortId: (projectId: string) => ({
    column: 'project_id' as const,
    value: projectId,
    validate: () => {
      if (!isProjectShortId(projectId)) {
      }
    }
  }),
  
  /** Query child tables by project foreign key (UUID) */
  byProjectForeignKey: (projectUUID: string) => ({
    column: 'project_id' as const,
    value: projectUUID,
    validate: () => {
      if (!isUUID(projectUUID)) {
        throw new Error(`CRITICAL: project_id foreign key must be UUID, got: ${projectUUID}`);
      }
    }
  }),
};
