import { NextResponse } from "next/server";
import { qstashReceiver } from "@/lib/qstash-client";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 30;
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

  // Always return 200 to QStash to prevent infinite retry loops
  try {
    const payload = JSON.parse(body);
    const taskId = payload.taskId as string | undefined;

    if (!taskId) {
      console.error("[worker:dlq] No taskId in payload");
      return NextResponse.json({ status: "ok", note: "no taskId" });
    }

    console.log("[worker:dlq] Dead-lettering task", { taskId });

    const admin = createAdminClient();
    await admin
      .from("ai_task_queue")
      .update({
        status: "dead_lettered",
        error_message:
          payload.error || "Task exceeded retry limit (dead-letter queue)",
        failed_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .in("status", ["queued", "running"]);

    // Mark associated story generation session as failed
    if (payload.task_type === "story_generation" && payload.sessionId) {
      await admin
        .from("story_generation_sessions")
        .update({
          status: "failed",
          error_message: "Story generation failed after multiple retries. Please try again.",
          completed_at: new Date().toISOString(),
          progress: 0,
          progress_message: "Failed",
        } as any)
        .eq("id", payload.sessionId);
    }

    // Log dependency analysis dead-letter (no session table — generic ai_task_queue update above handles it)
    if (payload.task_type === "dependency_analysis" || payload.task_type === "story_dependency_analysis") {
      console.log("[worker:dlq] Dependency analysis dead-lettered", { taskId });
    }

    // Log sprint task dead-letters (no session table — generic ai_task_queue update above handles it)
    if (payload.task_type === "sprint_goal" || payload.task_type === "sprint_description_reformat") {
      console.log("[worker:dlq] Sprint task dead-lettered", { taskId, task_type: payload.task_type });
    }

    // Log dashboard AI task dead-letters (no session table — generic ai_task_queue update above handles it)
    if (payload.task_type === "team_optimization" || payload.task_type === "priority_recommendations") {
      console.log("[worker:dlq] Dashboard AI task dead-lettered", { taskId, task_type: payload.task_type });
    }

    // Mark associated TAWOS training run as failed
    if (payload.task_type === "tawos_training" && payload.trainingRunId) {
      await (admin.from("tawos_training_runs" as any) as any)
        .update({
          status: "failed",
          error_message: "Training failed after multiple retries. Please try again.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", payload.trainingRunId);
    }

    return NextResponse.json({ status: "ok", taskId });
  } catch (error) {
    console.error("[worker:dlq] Error processing DLQ:", error);
    // Still return 200 — don't trigger QStash retries on DB errors
    return NextResponse.json({ status: "ok", error: "internal" });
  }
}
