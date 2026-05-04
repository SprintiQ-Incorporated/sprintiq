/**
 * Persona UI/Application Types
 *
 * These types are transformed from database row types for use in UI components.
 */

import type {
  PersonaWithRelations,
  UsageFrequency,
  PriorityLevel,
} from '../database/personas';

/** Persona type for UI components */
export interface Persona {
  id: string;
  personaId: string;       // Human-readable ID
  name: string;
  description: string;

  // Attributes
  techSavviness: number;   // 1-5
  usageFrequency: UsageFrequency;
  priorityLevel: PriorityLevel;
  role?: string;
  domain?: string;

  // AI/TAWOS
  autoDetected: boolean;
  tawosPatterns?: Record<string, unknown>;

  // Organization
  workspaceId: string;

  // Creator
  createdById: string;
  createdByName?: string;
  createdByAvatarUrl?: string;

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;

  // Associations
  projectIds?: string[];
}

/**
 * Transform database row to UI model
 */
export function toPersona(row: PersonaWithRelations): Persona {
  return {
    id: row.id,
    personaId: row.persona_id,
    name: row.name,
    description: row.description,

    // Attributes
    techSavviness: row.tech_savviness || 3,
    usageFrequency: row.usage_frequency || 'weekly',
    priorityLevel: row.priority_level || 'medium',
    role: row.role || undefined,
    domain: row.domain || undefined,

    // AI/TAWOS
    autoDetected: row.auto_detected || false,
    tawosPatterns: row.tawos_patterns || undefined,

    // Organization
    workspaceId: row.workspace_id,

    // Creator
    createdById: row.created_by,
    createdByName: row.created_by_profile?.full_name || undefined,
    createdByAvatarUrl: row.created_by_profile?.avatar_url || undefined,

    // Timestamps
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,

    // Associations
    projectIds: row.project_personas?.map(pp => pp.project_id),
  };
}

/**
 * Transform array of rows
 */
export function toPersonas(rows: PersonaWithRelations[]): Persona[] {
  return rows.map(toPersona);
}

/**
 * Get tech savviness label
 */
export function getTechSavvinessLabel(level: number): string {
  const labels: Record<number, string> = {
    1: 'Novice',
    2: 'Basic',
    3: 'Intermediate',
    4: 'Advanced',
    5: 'Expert',
  };
  return labels[level] || 'Intermediate';
}

/**
 * Get usage frequency label
 */
export function getUsageFrequencyLabel(frequency: UsageFrequency): string {
  const labels: Record<UsageFrequency, string> = {
    'daily': 'Daily User',
    'weekly': 'Weekly User',
    'monthly': 'Monthly User',
  };
  return labels[frequency] || 'Weekly User';
}

/**
 * Get priority level color
 */
export function getPriorityLevelColor(priority: PriorityLevel): string {
  const colors: Record<PriorityLevel, string> = {
    'high': 'red',
    'medium': 'yellow',
    'low': 'green',
  };
  return colors[priority] || 'gray';
}
