import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/rate-limit-v2";
import { verifyCsrfToken } from "@/lib/csrf-protection";
import { qstashClient } from "@/lib/qstash-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ReformatRequest {
  existingDescription: string;
  sprintId?: string;
}

const MAX_DESCRIPTION_LENGTH = 50_000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  // Verify CSRF token
  const csrfValid = await verifyCsrfToken(request);
  if (!csrfValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const { workspaceId } = await params;

  // Verify authentication
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check rate limit
  const rateLimitResponse = await withRateLimit(
    request,
    "ai_expensive",
    "user",
    user.id
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Parse request body
  let body: ReformatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { existingDescription, sprintId } = body;

  // Validate description
  if (!existingDescription || typeof existingDescription !== "string" || existingDescription.trim().length === 0) {
    return NextResponse.json(
      { error: "existingDescription is required and must be non-empty" },
      { status: 400 }
    );
  }

  if (existingDescription.length > MAX_DESCRIPTION_LENGTH) {
    return NextResponse.json(
      { error: `Description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters` },
      { status: 400 }
    );
  }

  // Resolve workspace internal UUID from slug
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("workspace_id", workspaceId)
    .single();

  if (workspaceError || !workspace) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 }
    );
  }

  const internalWorkspaceId = workspace.id;

  // ── Create ai_task_queue row ──────────────────────────────────────────────
  const admin = createAdminClient();
  const taskPayload = {
    existingDescription,
    sprintId: sprintId || null,
    workspaceId: internalWorkspaceId,
    userId: user.id,
    provider: "claude",
    task_type: "sprint_description_reformat" as const,
  };

  const { data: task, error: taskError } = await admin
    .from("ai_task_queue")
    .insert({
      workspace_id: internalWorkspaceId,
      created_by: user.id,
      queue: "fast",
      task_type: "sprint_description_reformat",
      source: "web",
      status: "queued",
      payload: taskPayload,
    } as any)
    .select("id")
    .single();

  if (taskError || !task) {
    console.error(
      "[sprints/reformat] Failed to create task:",
      taskError
    );
    return NextResponse.json(
      { error: "Failed to enqueue description reformat" },
      { status: 500 }
    );
  }

  // ── Publish to QStash ─────────────────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  try {
    await qstashClient.publishJSON({
      url: `${appUrl}/api/workers/fast`,
      body: { taskId: task.id, ...taskPayload },
      retries: 3,
    });
  } catch (qstashError) {
    console.error(
      "[sprints/reformat] QStash publish failed:",
      qstashError
    );
    await admin
      .from("ai_task_queue")
      .update({
        status: "failed",
        error_message: "Failed to publish to queue",
      })
      .eq("id", task.id);
    return NextResponse.json(
      { error: "Failed to enqueue description reformat" },
      { status: 500 }
    );
  }

  return NextResponse.json({ taskId: task.id }, { status: 202 });
}
