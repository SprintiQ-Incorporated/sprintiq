/**
 * UI/Application Model Types Index
 *
 * These types are transformed from database row types for use in UI components.
 * They flatten relationships, use camelCase property names, and include
 * transformer functions.
 *
 * Usage:
 *   import { Task, toTask } from '@/types/models';
 *   import type { TaskRow } from '@/types/database';
 *
 *   const dbRow: TaskRow = await fetchFromSupabase();
 *   const uiModel: Task = toTask(dbRow);
 */

// Tasks and stories
export * from './Task';

// Sprints
export * from './Sprint';

// Workspaces
export * from './Workspace';

// Personas
export * from './Persona';
