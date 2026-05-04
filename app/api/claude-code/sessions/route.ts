import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { verifyCsrfToken } from "@/lib/csrf-protection";
import { CLAUDE_CODE_SESSION_COLUMNS } from "@/lib/query-columns";
import type { Json, TaskSnapshot } from "@/lib/database-aliases";
import crypto from "crypto";

interface CreateSessionRequest {
  taskId: string;
  workspaceId: string;
  taskContext: { [key: string]: Json | undefined };
}

async function snapshotTask(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string
): Promise<TaskSnapshot | null> {
  const { data: task, error } = await supabase
    .from("tasks")
    .select("status_id, assignee_id, description, story_points, estimated_time, updated_at")
    .eq("id", taskId)
    .single();

  if (error || !task) return null;

  return {
    status_id: task.status_id,
    assignee_id: task.assignee_id,
    description: task.description,
    story_points: task.story_points ?? null,
    estimated_time: task.estimated_time ?? null,
    updated_at: task.updated_at!,
  };
}

export async function POST(request: NextRequest) {
  try {
    const csrfValid = await verifyCsrfToken(request);
    if (!csrfValid) {
      return NextResponse.json(
        { error: "Invalid CSRF token" },
        { status: 403 }
      );
    }

    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    let body: CreateSessionRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { taskId, workspaceId, taskContext } = body;

    if (!taskId || !workspaceId) {
      return NextResponse.json(
        { error: "taskId and workspaceId are required" },
        { status: 400 }
      );
    }

    const sessionToken = crypto.randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Snapshot current task state for conflict detection
    const taskSnapshot = await snapshotTask(supabase, taskId);

    const { data: session, error } = await supabase
      .from("claude_code_sessions")
      .insert({
        task_id: taskId,
        workspace_id: workspaceId,
        user_id: user.id,
        session_token: sessionToken,
        task_context: taskContext ?? {},
        expires_at: expiresAt,
        task_snapshot_at_start: taskSnapshot as unknown as Json,
      })
      .select()
      .single();

    if (error) {
      console.error("[claude-code/sessions] Insert error:", error);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ session, sessionToken, taskId });
  } catch (error) {
    console.error("[claude-code/sessions] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId query parameter is required" },
        { status: 400 }
      );
    }

    const { data: sessions, error } = await supabase
      .from("claude_code_sessions")
      .select(CLAUDE_CODE_SESSION_COLUMNS.CORE)
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[claude-code/sessions] GET error:", error);
      return NextResponse.json(
        { error: "Failed to fetch sessions" },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessions: sessions ?? [] });
  } catch (error) {
    console.error("[claude-code/sessions] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
