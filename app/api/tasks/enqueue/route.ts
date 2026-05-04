import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { verifyCsrfToken } from "@/lib/csrf-protection";
import { qstashClient } from "@/lib/qstash-client";
import { withRateLimit } from "@/lib/rate-limit-v2";
import type { Json } from "@/lib/database-aliases";
import type { AITaskQueue } from "@/types/database/ai-task-queue";
import type { EnqueueRequestBody, EnqueueResponse } from "@/types/api/task-queue";

const VALID_QUEUES: AITaskQueue[] = ["fast", "heavy", "embeddings"];

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF check
    const csrfValid = await verifyCsrfToken(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    // 2. Auth
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Parse and validate body
    const body = (await request.json()) as EnqueueRequestBody;
    const { workspaceId, task_type, payload } = body;

    if (!workspaceId || !task_type || !payload) {
      return NextResponse.json(
        { error: "Missing required fields: workspaceId, task_type, payload" },
        { status: 400 }
      );
    }

    const queue: AITaskQueue =
      body.queue && VALID_QUEUES.includes(body.queue) ? body.queue : "fast";

    // 4. Resolve source: header takes precedence over body
    const headerSource = request.headers.get("X-SprintIQ-Source");
    const source = headerSource || body.source || "web";

    // 5. Resolve workspace and verify ownership
    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .select("id, owner_id")
      .eq("workspace_id", workspaceId)
      .single();

    if (wsError || !workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    if (workspace.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const internalWorkspaceId = workspace.id;

    // 7. Rate limit — per-user AI task submission
    const rlResponse = await withRateLimit(request, "claude_per_user", "user", user.id);
    if (rlResponse) return rlResponse;

    // 8. Insert ai_task_queue row
    const { data: taskRow, error: insertError } = await supabase
      .from("ai_task_queue")
      .insert({
        workspace_id: internalWorkspaceId,
        created_by: user.id,
        queue,
        task_type,
        source,
        status: "queued" as const,
        payload: payload as unknown as Json,
      })
      .select("id")
      .single();

    if (insertError || !taskRow) {
      console.error("[enqueue] Insert failed:", insertError);
      return NextResponse.json(
        { error: "Failed to create task" },
        { status: 500 }
      );
    }

    const taskId = taskRow.id;

    // 9. Publish to QStash
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    let messageId: string;
    try {
      const result = await qstashClient.publishJSON({
        url: `${appUrl}/api/workers/${queue}`,
        body: { ...payload, task_type, source, taskId, workspaceId, userId: user.id },
      });
      messageId = result.messageId;
    } catch (publishError) {
      // 10. QStash publish failed — mark task as failed immediately
      console.error("[enqueue] QStash publish failed:", publishError);
      const admin = createAdminClient();
      await admin
        .from("ai_task_queue")
        .update({
          status: "failed",
          error_message: "QStash publish failed",
          failed_at: new Date().toISOString(),
        })
        .eq("id", taskId);

      return NextResponse.json(
        { error: "Failed to enqueue task" },
        { status: 502 }
      );
    }

    // 11. Store qstash_message_id on the row
    const admin = createAdminClient();
    await admin
      .from("ai_task_queue")
      .update({ qstash_message_id: messageId })
      .eq("id", taskId);

    // 12. Return 202
    const response: EnqueueResponse = {
      taskId,
      messageId,
      status: "queued",
      pollUrl: `/api/tasks/${taskId}`,
    };

    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    console.error("[enqueue] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
