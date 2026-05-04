import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/rate-limit-v2";
import { verifyCsrfToken } from "@/lib/csrf-protection";
import { qstashClient } from "@/lib/qstash-client";
import type { TAWOSIssue } from "@/lib/tawos-training-helpers";

// Max issues per training run — beyond this, the worker may exceed 300s
const MAX_ISSUES = 1500;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const csrfValid = await verifyCsrfToken(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    const { workspaceId } = await params;
    const supabase = await createServerSupabaseClient();

    // Check authentication
    const { user } = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResponse = await withRateLimit(
      request,
      "ai_expensive",
      "user",
      user.id
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Resolve internal workspace ID
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("workspace_id", workspaceId)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const issues: TAWOSIssue[] = body.issues;
    const originalFilename: string | undefined = body.originalFilename;

    if (!issues || !Array.isArray(issues) || issues.length === 0) {
      return NextResponse.json(
        { error: "No valid issues provided" },
        { status: 400 }
      );
    }

    if (issues.length > MAX_ISSUES) {
      return NextResponse.json(
        {
          error: `Too many issues (${issues.length}). Maximum is ${MAX_ISSUES} per training run. Please split your file.`,
        },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Create tawos_training_runs row
    const { data: trainingRun, error: runError } = await (
      adminClient.from("tawos_training_runs" as any) as any
    )
      .insert({
        workspace_id: workspace.id,
        created_by: user.id,
        status: "queued",
        total_issues: issues.length,
        input_data: issues,
        source: "upload",
        original_filename: originalFilename || null,
      })
      .select("id")
      .single();

    if (runError || !trainingRun) {
      console.error("[train-tawos] Failed to create training run:", runError);
      return NextResponse.json(
        { error: "Failed to create training run" },
        { status: 500 }
      );
    }

    // Create ai_task_queue row
    const taskPayload = {
      trainingRunId: trainingRun.id,
      workspaceId: workspace.id,
      userId: user.id,
      task_type: "tawos_training" as const,
    };

    const { data: task, error: taskError } = await adminClient
      .from("ai_task_queue")
      .insert({
        workspace_id: workspace.id,
        created_by: user.id,
        queue: "heavy",
        task_type: "tawos_training",
        source: "web",
        status: "queued",
        payload: taskPayload,
      } as any)
      .select("id")
      .single();

    if (taskError || !task) {
      console.error("[train-tawos] Failed to create task:", taskError);
      // Clean up the training run
      await (adminClient.from("tawos_training_runs" as any) as any)
        .update({ status: "failed", error_message: "Failed to enqueue task" })
        .eq("id", trainingRun.id);
      return NextResponse.json(
        { error: "Failed to enqueue training task" },
        { status: 500 }
      );
    }

    // Link training run to task
    await (adminClient.from("tawos_training_runs" as any) as any)
      .update({ task_id: task.id })
      .eq("id", trainingRun.id);

    // Publish to QStash — payload is lightweight (issues are in DB)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    try {
      await qstashClient.publishJSON({
        url: `${appUrl}/api/workers/heavy`,
        body: { taskId: task.id, ...taskPayload },
        retries: 3,
      });
    } catch (qstashError) {
      console.error("[train-tawos] QStash publish failed:", qstashError);
      await adminClient
        .from("ai_task_queue")
        .update({ status: "failed", error_message: "Failed to publish to queue" })
        .eq("id", task.id);
      await (adminClient.from("tawos_training_runs" as any) as any)
        .update({ status: "failed", error_message: "Failed to publish to queue" })
        .eq("id", trainingRun.id);
      return NextResponse.json(
        { error: "Failed to enqueue training task" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        trainingRunId: trainingRun.id,
        taskId: task.id,
        totalIssues: issues.length,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error in TAWOS training:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
