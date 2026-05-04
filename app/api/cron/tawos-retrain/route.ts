import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { qstashClient } from "@/lib/qstash-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Weekly TAWOS retraining cron — refreshes analysis patterns for all workspaces
 * that have existing training data. No re-embedding; just re-runs analyzeTAWOSDataset.
 *
 * Schedule: 0 2 * * 0 (Sunday 2am UTC)
 */
export async function GET(request: NextRequest) {
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isValidBearer = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isVercelCron && !isValidBearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    // Find all workspaces with existing training data
    const { data: workspaces, error: queryError } = await (
      admin.from("tawos_training_data" as any) as any
    )
      .select("workspace_id")
      .order("created_at", { ascending: false });

    if (queryError) {
      console.error("[tawos-retrain] Query error:", queryError);
      return NextResponse.json(
        { error: "Failed to query workspaces" },
        { status: 500 }
      );
    }

    // Deduplicate workspace IDs
    const workspaceIds = [
      ...new Set((workspaces || []).map((w: any) => w.workspace_id as string)),
    ];

    if (workspaceIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No workspaces with training data found",
        enqueued: 0,
      });
    }

    let enqueued = 0;

    for (const wsId of workspaceIds) {
      try {
        // Create training run for retraining
        const { data: run, error: runError } = await (
          admin.from("tawos_training_runs" as any) as any
        )
          .insert({
            workspace_id: wsId,
            created_by: null,
            status: "queued",
            total_issues: 0,
            source: "retraining_cron",
            input_data: null,
          })
          .select("id")
          .single();

        if (runError || !run) {
          console.error(`[tawos-retrain] Failed to create run for ${wsId}:`, runError);
          continue;
        }

        // Create ai_task_queue row
        const taskPayload = {
          trainingRunId: run.id,
          workspaceId: wsId,
          userId: "",
          task_type: "tawos_training" as const,
        };

        const { data: task, error: taskError } = await admin
          .from("ai_task_queue")
          .insert({
            workspace_id: wsId,
            created_by: null,
            queue: "heavy",
            task_type: "tawos_training",
            source: "cron",
            status: "queued",
            payload: taskPayload,
          } as any)
          .select("id")
          .single();

        if (taskError || !task) {
          console.error(`[tawos-retrain] Failed to create task for ${wsId}:`, taskError);
          continue;
        }

        // Link run to task
        await (admin.from("tawos_training_runs" as any) as any)
          .update({ task_id: task.id })
          .eq("id", run.id);

        // Publish to QStash
        await qstashClient.publishJSON({
          url: `${appUrl}/api/workers/heavy`,
          body: { taskId: task.id, ...taskPayload },
          retries: 3,
        });

        enqueued++;
      } catch (wsError) {
        console.error(`[tawos-retrain] Error processing workspace ${wsId}:`, wsError);
      }
    }

    return NextResponse.json({
      success: true,
      workspacesFound: workspaceIds.length,
      enqueued,
    });
  } catch (error) {
    console.error("[tawos-retrain] Fatal error:", error);
    return NextResponse.json(
      { error: "Retraining cron failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
