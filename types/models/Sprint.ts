/**
 * Sprint UI/Application Types
 *
 * These types are transformed from database row types for use in UI components.
 */

import type { SprintWithRelations, SprintRow, SprintStatus } from '../database/sprints';
import type { Task } from './Task';
import { toTask } from './Task';

/** Sprint status for UI display */
export type SprintStatusDisplay = 'Planning' | 'Active' | 'Completed';

/** Sprint type for UI components */
export interface Sprint {
  id: string;
  sprintId: string;        // Human-readable ID
  name: string;
  goal?: string;

  // Dates
  startDate?: Date;
  endDate?: Date;
  duration: number;        // in days or weeks depending on context

  // Organization
  sprintFolderId: string;
  sprintFolderName?: string;
  spaceId: string;
  workspaceId?: string;

  // Status
  status: SprintStatusDisplay;

  // Metrics (computed)
  storyCount?: number;
  totalStoryPoints?: number;
  completedStoryPoints?: number;
  velocity?: number;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;

  // Related stories
  stories?: Task[];
}

/** Sprint with full story data for sprint board */
export interface SprintWithStories extends Sprint {
  stories: Task[];
  capacityUtilization?: number;
}

/**
 * Map database status to display format
 */
export function toSprintStatusDisplay(status: SprintStatus | null | undefined): SprintStatusDisplay {
  const statusMap: Record<SprintStatus, SprintStatusDisplay> = {
    'planned': 'Planning',
    'active': 'Active',
    'completed': 'Completed',
  };
  return statusMap[status || 'planned'] || 'Planning';
}

/**
 * Transform database row to UI model
 */
export function toSprint(row: SprintWithRelations): Sprint {
  const stories = row.tasks?.map(toTask) || [];

  return {
    id: row.id,
    sprintId: row.sprint_id,
    name: row.name,
    goal: row.goal || undefined,

    // Dates
    startDate: row.start_date ? new Date(row.start_date) : undefined,
    endDate: row.end_date ? new Date(row.end_date) : undefined,
    duration: row.duration || 14, // Default 2 weeks

    // Organization
    sprintFolderId: row.sprint_folder_id,
    sprintFolderName: row.sprint_folder?.name,
    spaceId: row.space_id,
    workspaceId: row.workspace_id || undefined,

    // Status
    status: toSprintStatusDisplay(row.status),

    // Metrics
    storyCount: stories.length,
    totalStoryPoints: stories.reduce((sum, s) => sum + (s.storyPoints || 0), 0),
    completedStoryPoints: stories
      .filter(s => s.statusType === 'done')
      .reduce((sum, s) => sum + (s.storyPoints || 0), 0),

    // Timestamps
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,

    // Stories
    stories,
  };
}

/**
 * Transform array of rows
 */
export function toSprints(rows: SprintWithRelations[]): Sprint[] {
  return rows.map(toSprint);
}

/**
 * Calculate sprint velocity
 */
export function calculateSprintVelocity(sprint: Sprint): number {
  if (!sprint.stories || sprint.stories.length === 0) return 0;

  const completedPoints = sprint.stories
    .filter(s => s.statusType === 'done')
    .reduce((sum, s) => sum + (s.storyPoints || 0), 0);

  return completedPoints;
}

/**
 * Calculate capacity utilization percentage
 */
export function calculateCapacityUtilization(
  sprint: Sprint,
  teamCapacityPoints: number
): number {
  if (teamCapacityPoints <= 0) return 0;

  const totalPoints = sprint.totalStoryPoints || 0;
  return Math.round((totalPoints / teamCapacityPoints) * 100);
}
