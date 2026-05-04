/**
 * Workspace UI/Application Types
 *
 * These types are transformed from database row types for use in UI components.
 */

import type { WorkspaceWithRelations } from '../database/workspaces';

/** Workspace type for UI components */
export interface Workspace {
  id: string;
  workspaceId: string;     // Human-readable ID
  name: string;

  // Classification
  purpose: string;
  type: string;
  category: string;

  // Owner
  ownerId: string;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;

  // Counts (computed)
  spaceCount?: number;
  memberCount?: number;
}

/**
 * Transform database row to UI model
 */
export function toWorkspace(row: WorkspaceWithRelations): Workspace {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,

    // Classification
    purpose: row.purpose,
    type: row.type,
    category: row.category,

    // Owner
    ownerId: row.owner_id,

    // Timestamps
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,

    // Counts
    spaceCount: row.spaces?.length,
  };
}
