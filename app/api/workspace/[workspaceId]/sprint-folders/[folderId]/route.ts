import { createClient, getAuthUser } from "@/lib/supabase/server";
import { verifyCsrfToken } from "@/lib/csrf-protection";
import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE /api/workspace/[workspaceId]/sprint-folders/[folderId]
 *
 * Deletes a sprint folder and soft-deletes all sprints within it.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; folderId: string }> }
) {
  try {
    const csrfValid = await verifyCsrfToken(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const { workspaceId, folderId } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Look up the internal workspace UUID from the friendly workspace_id
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

    // Look up internal folder UUID from friendly ID
    const { data: folder, error: folderError } = await supabase
      .from("sprint_folders")
      .select("id, name")
      .eq("sprint_folder_id", folderId)
      .is("deleted_at", null)
      .single();

    if (folderError || !folder) {
      return NextResponse.json(
        { error: "Sprint folder not found" },
        { status: 404 }
      );
    }

    const folderUuid = folder.id;

    // Soft-delete all sprints in this folder (cascade)
    const { data: deletedSprints, error: sprintsError } = await supabase
      .from("sprints")
      .update({ deleted_at: new Date().toISOString() })
      .eq("sprint_folder_id", folderUuid)
      .is("deleted_at", null)
      .select("id, name");

    if (sprintsError) {
      console.error("Error soft-deleting sprints:", sprintsError);
      return NextResponse.json(
        { error: "Failed to delete sprints in folder" },
        { status: 500 }
      );
    }

    // Soft-delete the sprint folder itself
    const { error: deleteError } = await supabase
      .from("sprint_folders")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", folderUuid);

    if (deleteError) {
      console.error("Error deleting sprint folder:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete sprint folder" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Deleted folder "${folder.name}" and ${deletedSprints?.length || 0} sprint(s)`,
      data: {
        folderId: folderId,
        folderUuid: folderUuid,
        deletedSprintsCount: deletedSprints?.length || 0,
        deletedSprints: deletedSprints?.map((s) => s.name) || [],
      },
    });
  } catch (error) {
    console.error("Unexpected error deleting sprint folder:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
