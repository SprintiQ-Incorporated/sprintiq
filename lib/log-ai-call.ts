/**
 * Fire-and-forget AI call logger.
 *
 * Inserts a row into ai_task_logs (every attempt, success or failure)
 * and updates result_meta on ai_task_queue (success only, if taskId provided).
 * Never throws — wraps in try/catch, logs to console.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export interface LogAICallParams {
  taskId?: string;
  provider: string;
  model: string;
  queue: string;
  taskType?: string;
  success: boolean;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  errorCode?: string;
  errorMessage?: string;
}

const MAX_ERROR_MESSAGE_LENGTH = 500;

export async function logAICall(params: LogAICallParams): Promise<void> {
  try {
    const supabase = createAdminClient();

    const errorMessage = params.errorMessage
      ? params.errorMessage.slice(0, MAX_ERROR_MESSAGE_LENGTH)
      : undefined;

    // 1. Insert into ai_task_logs (every attempt)
    const insertLog = (supabase.from("ai_task_logs" as any) as any).insert({
      task_id: params.taskId || null,
      provider: params.provider,
      model: params.model,
      queue: params.queue,
      task_type: params.taskType || null,
      success: params.success,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      cost_usd: params.costUsd,
      duration_ms: params.durationMs,
      error_code: params.errorCode || null,
      error_message: errorMessage || null,
    });

    // 2. Update result_meta on ai_task_queue (success only, if taskId)
    const updateMeta =
      params.success && params.taskId
        ? supabase
            .from("ai_task_queue")
            .update({
              result_meta: {
                model: params.model,
                input_tokens: params.inputTokens,
                output_tokens: params.outputTokens,
                cost_usd: params.costUsd,
                duration_ms: params.durationMs,
              },
            })
            .eq("id", params.taskId)
        : Promise.resolve();

    await Promise.all([insertLog, updateMeta]);
  } catch (err) {
    console.error("[log-ai-call] Failed to log AI call:", err);
  }
}
