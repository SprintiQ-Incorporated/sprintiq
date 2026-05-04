import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { verifyCsrfToken } from "@/lib/csrf-protection";

/**
 * POST /api/workspace/[workspaceId]/sprints/[sprintId]/archive
 *
 * Archives a completed sprint and its tasks into the archive tables.
 * Turbo uses the archived data for historical pattern learning.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; sprintId: string }> }
) {
  try {
    // Verify CSRF token
    const csrfValid = await verifyCsrfToken(request);
    if (!csrfValid) {
      return NextResponse.json(
        { error: "Invalid CSRF token" },
        { status: 403 }
      );
    }

    const { workspaceId, sprintId } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve workspace and verify ownership
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id, owner_id")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .single();

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    if (workspace.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Resolve sprint - sprintId param could be either UUID or friendly sprint_id
    const { data: sprint } = await supabase
      .from("sprints")
      .select("id, project_id")
      .or(`id.eq.${sprintId},sprint_id.eq.${sprintId}`)
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .single();

    if (!sprint) {
      return NextResponse.json(
        { error: "Sprint not found" },
        { status: 404 }
      );
    }

    // Get the user's profile ID for archived_by
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Parse optional notes from request body
    let notes: string | null = null;
    try {
      const body = await request.json();
      notes = body.notes || null;
    } catch {
      // No body or invalid JSON is fine - notes are optional
    }

    // Call the atomic archive function
    // archive_sprint RPC exists in DB but is missing from generated types
    const { data, error } = await (supabase.rpc as any)("archive_sprint", {
      p_sprint_id: sprint.id,
      p_archived_by: profile.id,
      p_archive_notes: notes,
    });

    if (error) {
      console.error("Archive sprint error:", error);

      if (error.message.includes("Only completed sprints")) {
        return NextResponse.json(
          { error: "Only completed sprints can be archived" },
          { status: 400 }
        );
      }
      if (error.message.includes("already archived")) {
        return NextResponse.json(
          { error: "Sprint has already been archived" },
          { status: 409 }
        );
      }
      if (error.message.includes("Sprint not found")) {
        return NextResponse.json(
          { error: "Sprint not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: "Failed to archive sprint" },
        { status: 500 }
      );
    }

    // Check if the project was closed out by the archive function
    let projectClosed = false;
    const projectId = sprint.project_id;
    if (projectId) {
      const { data: project } = await supabase
        .from("projects")
        .select("deleted_at")
        .eq("id", projectId)
        .single();

      projectClosed = project?.deleted_at != null;
    }

    return NextResponse.json({
      archivedSprintId: data,
      projectClosed,
      projectId: projectClosed ? projectId : undefined,
      message: projectClosed
        ? "Sprint archived and project closed out"
        : "Sprint archived successfully",
    });
  } catch (error) {
    console.error("Error in archive sprint:", error);
    return NextResponse.json(
      { error: "Failed to archive sprint" },
      { status: 500 }
    );
  }
}
