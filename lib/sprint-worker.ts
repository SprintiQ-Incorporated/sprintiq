/**
 * Sprint worker functions for ai-fast QStash queue.
 *
 * Handles sprint goal generation and description reformatting.
 * Dynamically imported by the fast worker route to keep cold starts lean.
 */

import { createAdminClient } from "@/lib/supabase/server";
import {
  generateSprintGoalCompletion,
  reformatDescriptionCompletion,
} from "@/lib/ai-provider";
import { logAICall } from "@/lib/log-ai-call";
import { qstashClient } from "@/lib/qstash-client";
import type { UserStory } from "@/types";

// ── Sprint Goal Generation ────────────────────────────────────────────────────

export interface SprintGoalPayload {
  stories: UserStory[];
  sprintId?: string;
  workspaceId: string;
  userId: string;
  sprintDuration: number;
  taskId?: string;
}

export interface SprintGoalResult {
  goal: string;
}

/**
 * Process a sprint goal generation task from the ai-fast queue.
 *
 * - Instantiates SprintCreationService and calls generateSprintGoal
 * - 15s AbortSignal timeout (defense-in-depth alongside ai-provider's 30s)
 * - If sprintId provided, backfills the sprint row in DB
 * - Logs the AI call via logAICall
 */
export async function processSprintGoalGeneration(
  payload: SprintGoalPayload
): Promise<SprintGoalResult> {
  const { stories, sprintId, taskId, sprintDuration } = payload;
  const startMs = Date.now();

  // Dynamic import to keep cold starts lean
  const { default: SprintCreationService } = await import(
    "@/lib/sprint-creation-service"
  );

  const service = new SprintCreationService({
    sprintDuration: sprintDuration,
  });

  // 15s timeout — defense-in-depth on top of ai-provider's global 30s
  const aiResult = await Promise.race([
    service.generateSprintGoal(stories, {}),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new SprintGoalTimeoutError()),
        15_000
      )
    ),
  ]);

  const goal = aiResult;
  const durationMs = Date.now() - startMs;

  // Backfill sprint row in DB if sprintId provided
  if (sprintId) {
    const admin = createAdminClient();
    await admin
      .from("sprints")
      .update({ goal })
      .eq("id", sprintId);
  }

  // Log AI call (fire-and-forget)
  logAICall({
    taskId,
    provider: "claude",
    model: "claude-sonnet-4-6",
    queue: "fast",
    taskType: "sprint_goal",
    success: true,
    inputTokens: 0, // Not available from service method
    outputTokens: 0,
    costUsd: 0,
    durationMs,
  });

  return { goal };
}

// ── Sprint Description Reformat ───────────────────────────────────────────────

export interface SprintDescriptionReformatPayload {
  existingDescription: string;
  sprintId?: string;
  workspaceId: string;
  userId: string;
  taskId?: string;
}

export interface SprintDescriptionReformatResult {
  formattedDescription: string;
}

/**
 * Process a sprint description reformat task from the ai-fast queue.
 *
 * - Routes through ai-provider.ts (gains circuit breaker + DeepSeek fallback)
 * - 30s explicit AbortSignal timeout (defense-in-depth)
 * - If sprintId provided, updates sprint description in DB
 * - Logs the AI call via logAICall
 */
export async function processSprintDescriptionReformat(
  payload: SprintDescriptionReformatPayload
): Promise<SprintDescriptionReformatResult> {
  const { existingDescription, sprintId, taskId } = payload;
  const startMs = Date.now();

  // Dynamic import to keep cold starts lean
  const { getDescriptionReformatterSystemPrompt } = await import(
    "@/lib/prompts/sprint-description-prompts"
  );

  const systemPrompt = getDescriptionReformatterSystemPrompt();

  // 30s explicit timeout — defense-in-depth on top of ai-provider's global timeout
  const aiResult = await Promise.race([
    reformatDescriptionCompletion(systemPrompt, existingDescription),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new SprintDescriptionTimeoutError()),
        30_000
      )
    ),
  ]);

  const formattedDescription = aiResult.text;
  const durationMs = Date.now() - startMs;

  // Note: sprints table has no 'description' column — the formatted result
  // is stored in ai_task_queue.result by the fast worker's completion handler.
  // If sprintId is provided, callers can retrieve the result via the task polling endpoint.

  // Log AI call (fire-and-forget)
  logAICall({
    taskId,
    provider: aiResult.provider,
    model: aiResult.model,
    queue: "fast",
    taskType: "sprint_description_reformat",
    success: true,
    inputTokens: aiResult.usage?.inputTokens ?? 0,
    outputTokens: aiResult.usage?.outputTokens ?? 0,
    costUsd: 0,
    durationMs,
  });

  return { formattedDescription };
}

// ── Enqueue helper (for future UI call sites) ─────────────────────────────────

/**
 * Enqueue a sprint goal generation task to the ai-fast queue.
 *
 * Call this AFTER a sprint has been saved to DB so the worker can
 * backfill the AI-generated goal directly into the sprint row.
 */
export async function enqueueSprintGoalGeneration(params: {
  stories: UserStory[];
  sprintId: string;
  workspaceId: string;
  userId: string;
  sprintDuration: number;
}): Promise<{ taskId: string }> {
  const admin = createAdminClient();

  const taskPayload = {
    stories: params.stories,
    sprintId: params.sprintId,
    workspaceId: params.workspaceId,
    userId: params.userId,
    sprintDuration: params.sprintDuration,
    provider: "claude",
    task_type: "sprint_goal" as const,
  };

  const { data: task, error: taskError } = await admin
    .from("ai_task_queue")
    .insert({
      workspace_id: params.workspaceId,
      created_by: params.userId,
      queue: "fast",
      task_type: "sprint_goal",
      source: "server",
      status: "queued",
      payload: taskPayload,
    } as any)
    .select("id")
    .single();

  if (taskError || !task) {
    throw new Error(
      `Failed to enqueue sprint goal generation: ${taskError?.message}`
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  await qstashClient.publishJSON({
    url: `${appUrl}/api/workers/fast`,
    body: { taskId: task.id, ...taskPayload },
    retries: 3,
  });

  return { taskId: task.id };
}

// ── Error classes ─────────────────────────────────────────────────────────────

export class SprintGoalTimeoutError extends Error {
  constructor() {
    super("Sprint goal generation timed out after 15s");
    this.name = "SprintGoalTimeoutError";
  }
}

export class SprintDescriptionTimeoutError extends Error {
  constructor() {
    super("Sprint description reformat timed out after 30s");
    this.name = "SprintDescriptionTimeoutError";
  }
}
