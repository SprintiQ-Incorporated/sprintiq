/**
 * Spaces Database Types
 *
 * Exact match to spaces table in Supabase.
 * Spaces are organizational containers within a workspace.
 */

import type { ProjectRow } from './projects';
import type { SprintFolderRow } from './sprints';

/** Risk level values */
export type RiskLevel = 'low' | 'medium' | 'high';

/** Portfolio status values */
export type PortfolioStatus = 'active' | 'planning' | 'on-hold' | 'completed';

/** Exact match to spaces table */
export interface SpaceRow {
  id: string;
  space_id: string; // Unique text identifier
  name: string;
  workspace_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  description: string | null;
  icon: string | null; // Default 'blue'
  is_private: boolean | null; // Default false
  deleted_at: string | null;

  // Portfolio fields
  risk_level: RiskLevel | null;
  portfolio_status: PortfolioStatus | null; // Default 'planning'
  color: string | null; // Default 'blue'
  progress: number | null; // Default 0, 0-100
  due_date: string | null;
  portfolio_metadata: Record<string, unknown> | null; // Default '{}'
}

/** Insert type */
export type SpaceInsert = Omit<SpaceRow, 'id' | 'created_at' | 'updated_at' | 'space_id'> & {
  id?: string;
  space_id?: string;
  created_at?: string;
  updated_at?: string;
};

/** Update type */
export type SpaceUpdate = Partial<Omit<SpaceRow, 'id'>> & { id: string };

/** With joined relations */
export interface SpaceWithRelations extends SpaceRow {
  projects?: ProjectRow[];
  sprint_folders?: SprintFolderRow[];
}

