/**
 * AI Task Queue Database Types
 *
 * Exact match to ai_task_queue table in Supabase.
 * Tracks async AI task lifecycle: queued → running → complete | failed | dead_lettered
 */

/** Valid worker queues */
export type AITaskQueue = 'fast' | 'heavy' | 'embeddings';

/** Valid task statuses */
export type AITaskStatus = 'queued' | 'running' | 'complete' | 'failed' | 'dead_lettered';

/** Metadata about AI model usage and cost for a completed task */
export interface AITaskResultMeta {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  duration_ms: number;
}

/** Exact match to ai_task_queue table */
export interface AITaskQueueRow {
  id: string;
  workspace_id: string;
  created_by: string;
  queue: AITaskQueue;
  task_type: string;
  source: string;
  status: AITaskStatus;
  qstash_message_id: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  result_meta: AITaskResultMeta | null;
  error_message: string | null;
  rl_requeue_count: number;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
}

/** Insert type — omits auto-generated fields */
export type AITaskQueueInsert = Omit<
  AITaskQueueRow,
  'id' | 'created_at' | 'updated_at' | 'started_at' | 'completed_at' | 'failed_at' | 'qstash_message_id' | 'result' | 'result_meta' | 'error_message'
> & {
  id?: string;
  qstash_message_id?: string;
};

/** Update type — partial pick for worker status transitions */
export type AITaskQueueUpdate = Partial<
  Pick<
    AITaskQueueRow,
    'status' | 'qstash_message_id' | 'result' | 'result_meta' | 'error_message' | 'rl_requeue_count' | 'error_code' | 'started_at' | 'completed_at' | 'failed_at'
  >
>;
