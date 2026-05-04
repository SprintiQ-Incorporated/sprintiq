import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyCsrfToken } from "@/lib/csrf-protection";

/**
 * API endpoint to find and fix orphaned tasks
 * GET: Find orphaned tasks in a space
 * POST: Restore orphaned tasks to a project
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const supabase = await createServerSupabaseClient();

    // Get query params
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get("spaceId");

    if (!spaceId) {
      return NextResponse.json(
        { error: "spaceId is required" },
        { status: 400 }
      );
    }

    // Find orphaned tasks: have sprint_id but no project_id
    const { data: orphanedTasks, error } = await supabase
      .from("tasks")
      .select(`
        id,
        name,
        task_id,
        sprint_id,
        project_id,
        space_id,
        status_id,
        created_at,
        sprint:sprints(id, name)
      `)
      .eq("space_id", spaceId)
      .is("project_id", null)
      .not("sprint_id", "is", null)
      .is("deleted_at", null);

    if (error) {
      console.error("Error finding orphaned tasks:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: orphanedTasks?.length || 0,
      orphanedTasks: orphanedTasks || [],
    });
  } catch (error) {
    console.error("Error in fix-orphaned-tasks GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const csrfValid = await verifyCsrfToken(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const { workspaceId } = await params;
    const supabase = await createServerSupabaseClient();

    const body = await request.json();
    const { spaceId, projectId } = body;

    if (!spaceId || !projectId) {
      return NextResponse.json(
        { error: "spaceId and projectId are required" },
        { status: 400 }
      );
    }

    // First, find orphaned tasks
    const { data: orphanedTasks, error: findError } = await supabase
      .from("tasks")
      .select("id, name")
      .eq("space_id", spaceId)
      .is("project_id", null)
      .not("sprint_id", "is", null)
      .is("deleted_at", null);

    if (findError) {
      console.error("Error finding orphaned tasks:", findError);
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!orphanedTasks || orphanedTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No orphaned tasks found",
        count: 0,
        restoredTasks: [],
      });
    }

    const taskIds = orphanedTasks.map((t) => t.id);

    // Restore orphaned tasks by setting their project_id
    const { data: restoredTasks, error: updateError } = await supabase
      .from("tasks")
      .update({
        project_id: projectId,
        updated_at: new Date().toISOString(),
      })
      .in("id", taskIds)
      .select("id, name");

    if (updateError) {
      console.error("Error restoring tasks:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Restored ${restoredTasks?.length || 0} orphaned tasks`,
      count: restoredTasks?.length || 0,
      restoredTasks: restoredTasks || [],
    });
  } catch (error) {
    console.error("Error in fix-orphaned-tasks POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
