/**
 * Personas Database Types
 *
 * Exact match to personas table in Supabase.
 * Personas represent user archetypes for story generation.
 */

import type { ProfileMinimal } from './profiles';
import type { ProjectRow } from './projects';

/** Usage frequency values */
export type UsageFrequency = 'daily' | 'weekly' | 'monthly';

/** Priority level values */
export type PriorityLevel = 'high' | 'medium' | 'low';

/** Exact match to personas table */
export interface PersonaRow {
  id: string;
  persona_id: string; // Unique text identifier
  name: string;
  description: string;
  workspace_id: string;
  created_by: string; // FK to profiles.id
  created_at: string | null;
  updated_at: string | null;
  tech_savviness: number | null; // 1-5
  usage_frequency: UsageFrequency | null;
  priority_level: PriorityLevel | null;
  role: string | null;
  domain: string | null;
  tawos_patterns: Record<string, unknown> | null; // jsonb
  auto_detected: boolean | null;
  deleted_at: string | null;
}

/** Insert type */
export type PersonaInsert = Omit<PersonaRow, 'id' | 'created_at' | 'updated_at' | 'persona_id'> & {
  id?: string;
  persona_id?: string;
  created_at?: string;
  updated_at?: string;
};

/** Update type */
export type PersonaUpdate = Partial<Omit<PersonaRow, 'id'>> & { id: string };

/** With joined relations */
export interface PersonaWithRelations extends PersonaRow {
  created_by_profile?: ProfileMinimal | null;
  project_personas?: ProjectPersonaRow[];
  projects?: ProjectRow[];
}

/** Exact match to project_personas table */
export interface ProjectPersonaRow {
  id: string;
  project_id: string;
  persona_id: string;
  created_at: string | null;
  created_by: string | null;
}

/** Insert type */
export type ProjectPersonaInsert = Omit<ProjectPersonaRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};
