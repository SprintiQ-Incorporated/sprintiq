/**
 * Task Personas Database Types
 *
 * Exact match to task_personas junction table in Supabase.
 * Maps tasks to personas (many-to-many relationship)
 */

/** Exact match to task_personas table */
export interface TaskPersonaRow {
  task_id: string; // FK to tasks.id, part of composite PK
  persona_id: string; // FK to personas.id, part of composite PK
}

/** Insert type */
export type TaskPersonaInsert = TaskPersonaRow;

/** Delete requires both keys */
export type TaskPersonaDelete = TaskPersonaRow;
