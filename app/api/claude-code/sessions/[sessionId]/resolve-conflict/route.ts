import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { verifyCsrfToken } from "@/lib/csrf-protection";
import type { ConflictData } from "@/lib/database-aliases";

interface ResolveConflictRequest {
  resolution: "keep_manual" | "apply_ai" | "field_level";
  fieldResolutions?: Record<string, "keep_manual" | "apply_ai">;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

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

    let body: ResolveConflictRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (!["keep_manual", "apply_ai", "field_level"].includes(body.resolution)) {
      return NextResponse.json(
        { error: "Invalid resolution type" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Fetch the session with conflict data
    const { data: session, error: fetchError } = await supabaseAdmin
      .from("claude_code_sessions")
      .select("id, task_id, workspace_id, conflict_detected, conflict_data, is_late_arrival, user_id")
      .eq("id", sessionId)
      .single();

    if (fetchError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Late arrivals without conflict data can be dismissed or applied directly
    const isLateArrivalNoConflict = session.is_late_arrival && !session.conflict_data;

    if (!isLateArrivalNoConflict && (!session.conflict_detected || !session.conflict_data)) {
      return NextResponse.json(
        { error: "No conflict to resolve" },
        { status: 400 }
      );
    }

    // Handle late arrival without field conflicts — just mark resolved
    if (isLateArrivalNoConflict) {
      await supabaseAdmin
        .from("claude_code_sessions")
        .update({
          conflict_resolved_at: new Date().toISOString(),
          conflict_resolution: body.resolution,
        })
        .eq("id", sessionId);

      return NextResponse.json({ resolved: true, resolution: body.resolution });
    }

    // Verify ownership
    const { data: workspace } = await supabaseAdmin
      .from("workspaces")
      .select("owner_id")
      .eq("id", session.workspace_id)
      .maybeSingle();

    if (!workspace || workspace.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const conflictData = session.conflict_data as unknown as ConflictData;
    const now = new Date().toISOString();

    if (body.resolution === "keep_manual") {
      // Keep manual changes, clear conflict flags
      await supabaseAdmin
        .from("claude_code_sessions")
        .update({
          conflict_detected: false,
          conflict_resolved_at: now,
          conflict_resolution: "keep_manual",
        })
        .eq("id", sessionId);
    } else if (body.resolution === "apply_ai") {
      // Apply all AI-proposed changes to the task
      const taskUpdates: Record<string, unknown> = {};
      for (const [field, data] of Object.entries(conflictData.fields)) {
        if (!data.autoResolved) {
          taskUpdates[field] = data.aiProposedValue;
        }
      }

      if (Object.keys(taskUpdates).length > 0) {
        taskUpdates.updated_at = now;
        await supabaseAdmin
          .from("tasks")
          .update(taskUpdates)
          .eq("id", session.task_id);
      }

      await supabaseAdmin
        .from("claude_code_sessions")
        .update({
          conflict_detected: false,
          conflict_resolved_at: now,
          conflict_resolution: "apply_ai",
        })
        .eq("id", sessionId);
    } else if (body.resolution === "field_level") {
      // Apply per-field resolutions
      if (!body.fieldResolutions) {
        return NextResponse.json(
          { error: "fieldResolutions required for field_level resolution" },
          { status: 400 }
        );
      }

      const taskUpdates: Record<string, unknown> = {};
      for (const [field, data] of Object.entries(conflictData.fields)) {
        if (data.autoResolved) continue;
        const fieldResolution = body.fieldResolutions[field];
        if (fieldResolution === "apply_ai") {
          taskUpdates[field] = data.aiProposedValue;
        }
        // "keep_manual" — no update needed
      }

      if (Object.keys(taskUpdates).length > 0) {
        taskUpdates.updated_at = now;
        await supabaseAdmin
          .from("tasks")
          .update(taskUpdates)
          .eq("id", session.task_id);
      }

      await supabaseAdmin
        .from("claude_code_sessions")
        .update({
          conflict_detected: false,
          conflict_resolved_at: now,
          conflict_resolution: "field_level",
        })
        .eq("id", sessionId);
    }

    // Recalculate sprint metrics if task fields were updated
    if (body.resolution === "apply_ai" || body.resolution === "field_level") {
      const { data: taskForSprint } = await supabaseAdmin
        .from("tasks")
        .select("sprint_id")
        .eq("id", session.task_id)
        .single();

      if (taskForSprint?.sprint_id) {
        const { error: rpcError } = await supabaseAdmin.rpc(
          "calculate_sprint_metrics",
          { p_sprint_id: taskForSprint.sprint_id }
        );
        if (rpcError) {
          console.error("[claude-code/sessions] Sprint metrics RPC error after conflict resolution:", rpcError);
        }
      }
    }

    return NextResponse.json({ resolved: true, resolution: body.resolution });
  } catch (error) {
    console.error("[claude-code/sessions] resolve-conflict error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
