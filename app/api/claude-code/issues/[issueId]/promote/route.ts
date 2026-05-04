import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import { getDefaultStatus } from "@/lib/services/statusService";


interface PromoteRequest {
  as_subtask?: boolean;
  override_points?: number;
  override_title?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const { issueId } = await params;
    const supabase = await createServerSupabaseClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body: PromoteRequest = await request.json();

    // Fetch the issue with its parent task context
    const { data: issue, error: fetchError } = await supabase
      .from("claude_code_issues")
      .select("*")
      .eq("id", issueId)
      .single();

    if (fetchError || !issue) {
      return NextResponse.json(
        { error: "Issue not found" },
        { status: 404 }
      );
    }

    if (issue.status !== "detected") {
      return NextResponse.json(
        { error: "Issue has already been processed" },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("owner_id")
      .eq("id", issue.workspace_id)
      .maybeSingle();

    if (!workspace || workspace.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Get parent task for context inheritance
    const { data: parentTask, error: taskError } = await supabase
      .from("tasks")
      .select("id, name, project_id, space_id, workspace_id, sprint_id, status_id")
      .eq("id", issue.task_id)
      .single();

    if (taskError || !parentTask || !parentTask.workspace_id) {
      return NextResponse.json(
        { error: "Parent task not found" },
        { status: 404 }
      );
    }

    const taskWorkspaceId = parentTask.workspace_id;

    if (!parentTask.space_id) {
      return NextResponse.json(
        { error: "Parent task has no space_id; cannot resolve default status" },
        { status: 500 }
      );
    }

    // Sprint-committed subtasks land in "To Do"; unsprinted land in "Backlog".
    // Fall back to getDefaultStatus if the named status is missing in this space.
    const targetName = parentTask.sprint_id ? "To Do" : "Backlog";
    const { data: namedMatch } = await supabase
      .from("statuses")
      .select("id")
      .eq("space_id", parentTask.space_id)
      .eq("type", "space")
      .is("deleted_at", null)
      .ilike("name", targetName)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    let defaultStatusId: string;
    if (namedMatch) {
      defaultStatusId = namedMatch.id;
    } else {
      const fallback = await getDefaultStatus(
        supabase,
        parentTask.space_id,
        taskWorkspaceId
      );
      defaultStatusId = fallback.id;
    }

    // Determine task tag based on issue type
    const tagName = issue.issue_type === "bug" ? "bug" : "tech-debt";

    // Create the subtask — task_id uses DB default
    const subtaskTitle = body.override_title || `[${issue.issue_type}] ${issue.title}`;
    const subtaskPoints = body.override_points ?? issue.suggested_points ?? undefined;

    const { data: newTask, error: insertError } = await supabase
      .from("tasks")
      .insert({
        name: subtaskTitle,
        project_id: parentTask.project_id,
        space_id: parentTask.space_id,
        workspace_id: taskWorkspaceId,
        sprint_id: parentTask.sprint_id,
        parent_task_id: body.as_subtask !== false ? parentTask.id : null,
        status_id: defaultStatusId,
        priority: issue.severity === "critical" || issue.severity === "high" ? "high" : "medium",
        story_points: subtaskPoints,
        description: issue.description || `Detected by Claude Code: ${issue.title}`,
        created_by: user.id,
      })
      .select("id, task_id, name")
      .single();

    if (insertError || !newTask) {
      console.error("Error creating subtask:", insertError);
      return NextResponse.json(
        { error: "Failed to create subtask" },
        { status: 500 }
      );
    }

    // Try to add the appropriate tag
    const { data: tag } = await supabase
      .from("tags")
      .select("id")
      .eq("workspace_id", taskWorkspaceId)
      .eq("name", tagName)
      .is("deleted_at", null)
      .maybeSingle();

    if (tag) {
      await supabase.from("task_tags").insert({
        task_id: newTask.id,
        tag_id: tag.id,
      });
    }

    // Update the issue status
    await supabase
      .from("claude_code_issues")
      .update({
        status: "subtask_created",
        subtask_id: newTask.id,
      })
      .eq("id", issueId);

    return NextResponse.json({
      task: newTask,
      issue: { id: issueId, status: "subtask_created" },
    });
  } catch (error) {
    console.error("Promote issue error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
