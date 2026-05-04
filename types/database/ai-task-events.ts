/**
 * AI Task Events Database Types
 *
 * Lifecycle events for ai_task_queue entries.
 * Tracks rate limiting, requeues, and failures — not AI metrics (see US-012 ai_task_logs).
 */

/** Valid event types for task lifecycle tracking */
export type AITaskEventType = 'rate_limited' | 'requeued' | 'failed' | 'info';

/** Exact match to ai_task_events table */
export interface AITaskEventRow {
  id: string;
  task_id: string;
  event_type: AITaskEventType;
  error_code: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Insert type — omits auto-generated fields */
export type AITaskEventInsert = Omit<AITaskEventRow, 'id' | 'created_at'>;
