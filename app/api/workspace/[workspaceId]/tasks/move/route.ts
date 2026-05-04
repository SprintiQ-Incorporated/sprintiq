import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import { verifyCsrfToken } from "@/lib/csrf-protection";
import { z } from "zod";

const moveTaskSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(50),
  targetProjectId: z.string().uuid(),
  targetSprintId: z.string().uuid().nullable().optional(),
  clearSprint: z.boolean().optional().default(true),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    // Verify CSRF token
    const csrfValid = await verifyCsrfToken(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    const { workspaceId } = await params;
    const supabase = await createServerSupabaseClient();

    // 1. Authenticate
    const { user, error: authError } = await getAuthUser(supabase);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and validate request
    const body = await request.json();
    const parsed = moveTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { taskIds, targetProjectId, targetSprintId, clearSprint } =
      parsed.data;

    // 3. Resolve workspace and verify ownership
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, owner_id")
      .eq("workspace_id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
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

    // 5. Get target project details
    const { data: targetProject, error: projectError } = await supabase
      .from("projects")
      .select("id, name, space_id, workspace_id")
      .eq("id", targetProjectId)
      .eq("workspace_id", internalWorkspaceId)
      .is("deleted_at", null)
      .single();

    if (projectError || !targetProject) {
      return NextResponse.json(
        { error: "Target project not found" },
        { status: 404 }
      );
    }

    // 5. Validate target sprint (if provided)
    if (targetSprintId) {
      const { data: targetSprint, error: sprintError } = await supabase
        .from("sprints")
        .select("id, project_id")
        .eq("id", targetSprintId)
        .eq("project_id", targetProjectId) // Sprint must belong to target project!
        .is("deleted_at", null)
        .single();

      if (sprintError || !targetSprint) {
        return NextResponse.json(
          {
            error:
              "Target sprint not found or doesn't belong to target project",
          },
          { status: 400 }
        );
      }
    }

    // 7. Get tasks to move
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, name, project_id, sprint_id, workspace_id")
      .in("id", taskIds)
      .eq("workspace_id", internalWorkspaceId)
      .is("deleted_at", null);

    if (tasksError) {
      return NextResponse.json(
        { error: "Failed to fetch tasks" },
        { status: 500 }
      );
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ error: "No valid tasks found" }, { status: 404 });
    }

    // 7. Check if any tasks are already in target project
    const tasksAlreadyInTarget = tasks.filter(
      (t) => t.project_id === targetProjectId
    );
    const tasksToMove = tasks.filter((t) => t.project_id !== targetProjectId);

    if (tasksToMove.length === 0) {
      return NextResponse.json({
        success: true,
        moved: [],
        skipped: tasksAlreadyInTarget.map((t) => ({
          id: t.id,
          reason: "Already in target project",
        })),
        message: "All tasks are already in the target project",
      });
    }

    // 8. Build update data
    const updateData: Record<string, unknown> = {
      project_id: targetProjectId,
      space_id: targetProject.space_id,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    // Clear sprint if moving to different project (or if explicitly requested)
    if (clearSprint || !targetSprintId) {
      updateData.sprint_id = targetSprintId || null;
    } else {
      updateData.sprint_id = targetSprintId;
    }

    // Reset backlog position
    updateData.backlog_position = 0;

    // 9. Perform the move
    const taskIdsToMove = tasksToMove.map((t) => t.id);
    const { data: movedTasks, error: updateError } = await supabase
      .from("tasks")
      .update(updateData)
      .in("id", taskIdsToMove)
      .select("id, name, task_id");

    if (updateError) {
      console.error("Error moving tasks:", updateError);
      return NextResponse.json(
        { error: "Failed to move tasks" },
        { status: 500 }
      );
    }

    // 10. Create audit events (batch insert)
    // 11. Return response
    return NextResponse.json({
      success: true,
      moved:
        movedTasks?.map((t) => ({ id: t.id, name: t.name, task_id: t.task_id })) ||
        [],
      skipped: tasksAlreadyInTarget.map((t) => ({
        id: t.id,
        reason: "Already in target project",
      })),
      targetProject: {
        id: targetProject.id,
        name: targetProject.name,
      },
    });
  } catch (error) {
    console.error("Move tasks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
