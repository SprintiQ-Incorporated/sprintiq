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
  const { taskId, userId } = payload;
  const admin = createAdminClient();

  // ── Stale task cleanup — mark zombie "running" tasks as failed ────────
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await admin
    .from("ai_task_queue")
    .update({
      status: "failed",
      error_message: "Task exceeded maximum runtime",
      failed_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .lt("started_at", fiveMinAgo);

  console.log("[worker:fast] Received task", {
    taskId,
    task_type: payload.task_type,
  });

  // ── Rate limit check ──────────────────────────────────────────────────
  if (taskId) {
    const checks: RateLimitCheck[] =
      payload.provider === "deepseek"
        ? [{ identifier: "global", preset: "deepseek_global" }]
        : [
            { identifier: "global", preset: "claude_global" },
            ...(userId
              ? [{ identifier: `user:${userId}`, preset: "claude_per_user" as const }]
              : []),
          ];

    const rl = await checkMultipleLimits(checks);

    if (!rl.allowed) {
      const { data: requeue } = await admin.rpc("try_requeue_task", {
        p_task_id: taskId,
      });

      const row = requeue?.[0];

      if (row?.requeued) {
        // Log event and republish with delay
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
          url: `${appUrl}/api/workers/fast`,
          body: payload,
          delay: 5,
        });
      } else {
        // Exhausted — task already marked failed by RPC
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

      return NextResponse.json({ status: "ok", queue: "ai-fast", rate_limited: true });
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
    // Dispatch to processing function based on task_type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;
    switch (payload.task_type) {
      case "dependency_analysis": {
        const { processDependencyAnalysis } = await import(
          "@/lib/dependency-analysis-worker"
        );
        result = await processDependencyAnalysis(payload);
        break;
      }
      case "story_dependency_analysis": {
        const { processStoryDependencyAnalysis } = await import(
          "@/lib/dependency-analysis-worker"
        );
        result = await processStoryDependencyAnalysis(payload);
        break;
      }
      case "sprint_goal": {
        const { processSprintGoalGeneration } = await import(
          "@/lib/sprint-worker"
        );
        result = await processSprintGoalGeneration(payload);
        break;
      }
      case "sprint_description_reformat": {
        const { processSprintDescriptionReformat } = await import(
          "@/lib/sprint-worker"
        );
        result = await processSprintDescriptionReformat(payload);
        break;
      }
      case "team_optimization": {
        const { processTeamOptimization } = await import(
          "@/lib/dashboard-worker"
        );
        result = await processTeamOptimization(payload);
        break;
      }
      case "priority_recommendations": {
        const { processPriorityRecommendations } = await import(
          "@/lib/dashboard-worker"
        );
        result = await processPriorityRecommendations(payload);
        break;
      }
      default:
        console.warn(`[worker:fast] Unknown task_type: ${payload.task_type}`);
        result = { error: `Unknown task_type: ${payload.task_type}` };
    }

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

    return NextResponse.json({ status: "ok", queue: "ai-fast" });
  } catch (error) {
    console.error("[worker:fast] Processing failed:", error);

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
    return NextResponse.json({ status: "ok", queue: "ai-fast" });
  }
}
