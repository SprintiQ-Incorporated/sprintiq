import { NextResponse } from "next/server";
import { qstashReceiver, qstashClient } from "@/lib/qstash-client";
import { createAdminClient } from "@/lib/supabase/server";
import { checkMultipleLimits, type RateLimitCheck } from "@/lib/rate-limit-v2";

export const maxDuration = 60;
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
  const { taskId } = payload;
  const admin = createAdminClient();

  console.log("[worker:embeddings] Received task", {
    taskId,
    task_type: payload.task_type,
  });

  // ── Rate limit check ──────────────────────────────────────────────────
  if (taskId) {
    const isBatch =
      typeof payload.task_type === "string" &&
      payload.task_type.startsWith("tawos_");

    const checks: RateLimitCheck[] = isBatch
      ? [{ identifier: "global", preset: "voyage_batch" }]
      : [{ identifier: "global", preset: "voyage_global" }];

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
          url: `${appUrl}/api/workers/embeddings`,
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

      return NextResponse.json({ status: "ok", queue: "embeddings", rate_limited: true });
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

  try {
    // TODO US-012+: dispatch to embedding pipeline based on payload.task_type
    const result = { placeholder: true };

    // Mark task as complete
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

    return NextResponse.json({ status: "ok", queue: "embeddings" });
  } catch (error) {
    console.error("[worker:embeddings] Processing failed:", error);

    // Mark task as failed
    if (taskId) {
      await admin
        .from("ai_task_queue")
        .update({
          status: "failed",
          error_message:
            error instanceof Error ? error.message : "Unknown error",
          failed_at: new Date().toISOString(),
        })
        .eq("id", taskId);
    }

    // Return 200 to QStash to prevent retries on application-level errors
    return NextResponse.json({ status: "ok", queue: "embeddings" });
  }
}
