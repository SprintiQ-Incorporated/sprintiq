/**
 * API Types for Task Queue Endpoints
 *
 * Request/response shapes for POST /api/tasks/enqueue and GET /api/tasks/[taskId]
 */

import type { AITaskQueue, AITaskResultMeta, AITaskStatus } from '../database/ai-task-queue';

/** POST /api/tasks/enqueue — request body */
export interface EnqueueRequestBody {
  workspaceId: string;
  task_type: string;
  queue?: AITaskQueue;
  source?: string;
  payload: Record<string, unknown>;
}

/** POST /api/tasks/enqueue — 202 response */
export interface EnqueueResponse {
  taskId: string;
  messageId: string;
  status: 'queued';
  pollUrl: string;
}

/** GET /api/tasks/[taskId] — response envelope */
export interface TaskStatusEnvelope {
  taskId: string;
  status: AITaskStatus;
  queue: AITaskQueue;
  task_type: string;
  source: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  result: Record<string, unknown> | null;
  result_meta: AITaskResultMeta | null;
  error: string | null;
}
