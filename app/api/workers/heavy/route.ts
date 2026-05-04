import { NextResponse } from "next/server";
import { qstashReceiver, qstashClient } from "@/lib/qstash-client";
import { createAdminClient } from "@/lib/supabase/server";
import { checkMultipleLimits, type RateLimitCheck } from "@/lib/rate-limit-v2";
import { logAICall } from "@/lib/log-ai-call";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("upstash-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  try {
    await qstashReceiver.verify({ signature, body });
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);
  const { taskId, userId } = payload;
  const admin = createAdminClient();

  console.log("[worker:heavy] Received task", {
    taskId,
    task_type: payload.task_type,
  });

  // ── Rate limit check ──────────────────────────────────────────────────
  if (taskId) {
    const checks: RateLimitCheck[] = [
      { identifier: "global", preset: "claude_global" },
      ...(userId
        ? [{ identifier: `user:${userId}`, preset: "claude_per_user" as const }]
        : []),
      { identifier: "global", preset: "claude_heavy" },
    ];

    const rl = await checkMultipleLimits(checks);

    if (!rl.allowed) {
      const { data: requeue } = await admin.rpc("try_requeue_task", {
        p_task_id: taskId,
      });

      const row = requeue?.[0];

      if (row?.requeued) {
        await admin.from("ai_task_events").insert({
          task_id: taskId,
          event_type: "rate_limited",
          error_code: rl.deniedPreset,
          metadata: {
            denied_preset: rl.deniedPreset,
            retry_after: rl.retryAfter,
            requeue_count: row.new_count,
          },
        });

        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        await qstashClient.publishJSON({
          url: `${appUrl}/api/workers/heavy`,
          body: payload,
          delay: 5,
        });
      } else {
        await admin.from("ai_task_events").insert({
          task_id: taskId,
          event_type: "failed",
          error_code: "RATE_LIMITED_EXHAUSTED",
          metadata: {
            denied_preset: rl.deniedPreset,
            retry_after: rl.retryAfter,
            requeue_count: row?.new_count ?? 0,
          },
        });
      }

      return NextResponse.json({ status: "ok", queue: "ai-heavy", rate_limited: true });
    }
  }

  // ── Mark task as running ──────────────────────────────────────────────
  if (taskId) {
    await admin
      .from("ai_task_queue")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("status", "queued");
  }

  const startTime = Date.now();
  let aiSuccess = false;
  let aiLogged = false;
  let aiError: { code?: string; message?: string } = {};

  try {
    // Dispatch to task-specific handler
    if (payload.task_type === "story_generation") {
      const { processStoryGeneration } = await import("@/lib/story-generation-worker");
      const workerResult = await processStoryGeneration(admin, payload, taskId);
      aiLogged = workerResult.aiLogged;
      aiSuccess = true;
    } else if (payload.task_type === "tawos_training") {
      const { processTawosTraining } = await import("@/lib/tawos-training-worker");
      const workerResult = await processTawosTraining(admin, payload, taskId);
      aiLogged = workerResult.aiLogged;
      aiSuccess = true;
    } else {
      console.warn("[worker:heavy] Unknown task_type:", payload.task_type);
      const result = { placeholder: true };
      aiSuccess = true;

      if (taskId) {
        await admin
          .from("ai_task_queue")
          .update({
            status: "complete",
            result,
            completed_at: new Date().toISOString(),
          })
          .eq("id", taskId);
      }
    }

    return NextResponse.json({ status: "ok", queue: "ai-heavy" });
  } catch (error) {
    console.error("[worker:heavy] Processing failed:", error);
    aiError = {
      code: "processing_error",
      message: error instanceof Error ? error.message : "Unknown error",
    };

    // Mark task as failed (only if not already handled by task-specific worker)
    if (taskId && !aiLogged) {
      await admin
        .from("ai_task_queue")
        .update({
          status: "failed",
          error_message: aiError.message,
          failed_at: new Date().toISOString(),
        })
        .eq("id", taskId);
    }

    // Return 200 to QStash to prevent retries on application-level errors
    return NextResponse.json({ status: "ok", queue: "ai-heavy" });
  } finally {
    // Skip logging if the task-specific handler already logged
    if (!aiLogged) {
      logAICall({
        taskId,
        provider: payload.provider || "claude",
        model: payload.model || "unknown",
        queue: "heavy",
        taskType: payload.task_type,
        success: aiSuccess,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        durationMs: Date.now() - startTime,
        errorCode: aiError.code,
        errorMessage: aiError.message,
      }).catch(() => {});
    }
  }
}
