/**
 * Task/Story UI/Application Types
 *
 * These types are transformed from database row types for use in UI components.
 */

import type { TaskWithRelations } from '../database/tasks';

/** Priority display values */
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';

/** Task status for UI (derived from status.status_type) */
export type TaskStatusType = 'todo' | 'in_progress' | 'done' | 'blocked' | 'review';

/** Task type values */
export type TaskType = 'story' | 'task' | 'bug' | 'subtask';

/** Task/Story type for UI components */
export interface Task {
  id: string;
  taskId: string;          // Human-readable ID
  name: string;
  description?: string;
  priority: TaskPriority;

  // Status
  statusId: string;
  statusName: string;
  statusColor: string;
  statusType?: TaskStatusType;

  // Assignment
  assigneeId?: string;
  assigneeName?: string;
  assigneeAvatarUrl?: string;

  // Organization
  projectId?: string;
  projectName?: string;
  sprintId?: string;
  sprintName?: string;
  spaceId?: string;
  workspaceId?: string;

  // Dates
  startDate?: Date;
  dueDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;

  // Estimation and scoring
  storyPoints?: number;
  estimatedTime?: number;
  businessValue?: number;
  userImpact?: number;
  complexity?: number;
  risk?: number;
  dependencyScore?: number;
  velocity?: number;

  // Hierarchy
  parentTaskId?: string;
  backlogPosition: number;

  // AI fields
  generatedByAi: boolean;
  personaId?: string;
  personaName?: string;
  generationSessionId?: string;

  // Tags
  tags: Array<{ id: string; name: string; color: string }>;

  // Creator
  createdById?: string;
  createdByName?: string;
}

/** User story format for story generator */
export interface UserStory {
  id: string;
  title: string;
  role: string;
  want: string;
  benefit: string;
  acceptanceCriteria: string[];
  storyPoints?: number;
  businessValue?: number;
  userImpact?: number;
  complexity?: number;
  risk?: number;
  dependencies?: string[];
  priority?: TaskPriority;
  description?: string;
  tags?: string[];
  parentTaskId?: string;
  childTaskIds?: string[];
  estimatedTime?: number;
  priorityScore?: number;
  dependencyScore?: number;
  sprintId?: string;
  personaId?: string;

  // Role recommendations when no team is provided
  recommendedRoles?: Array<{
    role: string;
    level: 'Junior' | 'Mid' | 'Senior' | 'Lead';
    requiredSkills: string[];
    estimatedHours: number;
    rationale: string;
  }>;
  skillMatch?: number;
}

/**
 * Map priority string to display format
 */
export function toPriorityDisplay(priority: string | null | undefined): TaskPriority {
  const priorityMap: Record<string, TaskPriority> = {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'critical': 'Critical',
  };
  return priorityMap[(priority || 'medium').toLowerCase()] || 'Medium';
}

/**
 * Transform database row to UI model
 */
export function toTask(row: TaskWithRelations): Task {
  return {
    id: row.id,
    taskId: row.task_id,
    name: row.name,
    description: row.description || undefined,
    priority: toPriorityDisplay(row.priority),

    // Status
    statusId: row.status_id,
    statusName: row.status?.name || 'Unknown',
    statusColor: row.status?.color || 'gray',
    statusType: (row.status as any)?.status_type?.name as TaskStatusType,

    // Assignment
    assigneeId: row.assignee_id || undefined,
    assigneeName: row.assignee?.full_name || undefined,
    assigneeAvatarUrl: row.assignee?.avatar_url || undefined,

    // Organization
    projectId: row.project_id || undefined,
    projectName: row.project?.name || undefined,
    sprintId: row.sprint_id || undefined,
    sprintName: row.sprint?.name || undefined,
    spaceId: row.space_id || undefined,
    workspaceId: row.workspace_id || undefined,

    // Dates
    startDate: row.start_date ? new Date(row.start_date) : undefined,
    dueDate: row.due_date ? new Date(row.due_date) : undefined,
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,

    // Estimation
    storyPoints: row.story_points || undefined,
    estimatedTime: row.estimated_time || undefined,
    businessValue: row.business_value || undefined,
    userImpact: row.user_impact || undefined,
    complexity: row.complexity || undefined,
    risk: row.risk || undefined,
    dependencyScore: row.dependency_score || undefined,
    velocity: row.velocity || undefined,

    // Hierarchy
    parentTaskId: row.parent_task_id || undefined,
    backlogPosition: row.backlog_position,

    // AI
    generatedByAi: row.generated_by_ai,
    personaId: row.persona_id || undefined,
    personaName: row.persona?.name || undefined,
    generationSessionId: row.task_ai_metadata?.generation_session_id || undefined,

    // Tags
    tags: (row.task_tags || []).map(tt => ({
      id: tt.tag.id,
      name: tt.tag.name,
      color: tt.tag.color || 'gray',
    })),

    // Creator
    createdById: row.created_by || undefined,
    createdByName: row.created_by_profile?.full_name || undefined,
  };
}

/**
 * Transform array of rows
 */
export function toTasks(rows: TaskWithRelations[]): Task[] {
  return rows.map(toTask);
}

/**
 * Transform Task UI model to UserStory format for story generator
 */
export function toUserStory(task: Task): UserStory {
  // Parse role/want/benefit from description if in user story format
  let role = '';
  let want = '';
  let benefit = '';

  const description = task.description || '';
  const asMatch = description.match(/As a[n]?\s+(.+?),?\s+I want/i);
  const wantMatch = description.match(/I want\s+(.+?),?\s+so that/i);
  const benefitMatch = description.match(/so that\s+(.+?)(?:\.|$)/i);

  if (asMatch) role = asMatch[1];
  if (wantMatch) want = wantMatch[1];
  if (benefitMatch) benefit = benefitMatch[1];

  return {
    id: task.id,
    title: task.name,
    role,
    want,
    benefit,
    acceptanceCriteria: [], // Would need to parse from description or separate field
    storyPoints: task.storyPoints,
    businessValue: task.businessValue,
    userImpact: task.userImpact,
    complexity: task.complexity,
    risk: task.risk,
    priority: task.priority,
    description: task.description,
    parentTaskId: task.parentTaskId,
    estimatedTime: task.estimatedTime,
    priorityScore: task.businessValue, // Use business value as priority score
    dependencyScore: task.dependencyScore,
    sprintId: task.sprintId,
    personaId: task.personaId,
  };
}
