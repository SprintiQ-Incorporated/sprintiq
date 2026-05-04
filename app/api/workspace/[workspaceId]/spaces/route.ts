import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";

/**
 * GET /api/workspace/[workspaceId]/spaces
 *
 * Fetches all spaces (portfolios) with their projects and sprint folders for a workspace.
 * Used by the story generator widget to populate save destinations.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
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

    // Fetch spaces (portfolios) for the workspace
    const { data: spaces, error: spacesError } = await supabase
      .from("spaces")
      .select(`
        id,
        space_id,
        name,
        description,
        icon,
        color,
        is_private
      `)
      .eq("workspace_id", internalWorkspaceId)
      .is("deleted_at", null)
      .order("name");

    if (spacesError) {
      console.error("Error fetching spaces:", spacesError);
      return NextResponse.json(
        { error: "Failed to fetch spaces" },
        { status: 500 }
      );
    }

    // Get both internal IDs and friendly space_ids for flexible querying
    const spaceInternalIds = spaces?.map((s) => s.id) || [];
    const spaceFriendlyIds = spaces?.map((s) => s.space_id) || [];

    // Fetch projects for each space (query by both internal ID and friendly ID to handle inconsistency)
    let projects: Array<{ id: string; project_id: string; name: string; space_id: string | null }> = [];
    if (spaceInternalIds.length > 0 || spaceFriendlyIds.length > 0) {
      // Query projects that match either internal ID or friendly space_id
      const { data: projectsByInternalId, error: projectsError1 } = await supabase
        .from("projects")
        .select(`
          id,
          project_id,
          name,
          space_id
        `)
        .in("space_id", spaceInternalIds)
        .is("deleted_at", null)
        .order("name");

      if (projectsError1) {
        console.error("Error fetching projects:", projectsError1);
      }
      projects = projectsByInternalId || [];
    }

    // Fetch sprint folders for each space (same flexible approach)
    let sprintFolders: Array<{ id: string; sprint_folder_id: string; name: string; space_id: string; duration_week: number | null }> = [];
    if (spaceInternalIds.length > 0 || spaceFriendlyIds.length > 0) {
      const { data: foldersData, error: foldersError } = await supabase
        .from("sprint_folders")
        .select(`
          id,
          sprint_folder_id,
          name,
          space_id,
          duration_week
        `)
        .in("space_id", spaceInternalIds)
        .is("deleted_at", null)
        .order("name");

      if (foldersError) {
        console.error("Error fetching sprint folders:", foldersError);
      }
      sprintFolders = foldersData || [];
    }

    // Combine the data - match projects to spaces by either internal ID or friendly space_id
    const spacesWithChildren = spaces?.map((space) => ({
      ...space,
      projects: projects?.filter((p) => p.space_id === space.id || p.space_id === space.space_id) || [],
      sprint_folders: sprintFolders?.filter((f) => f.space_id === space.id || f.space_id === space.space_id) || [],
    })) || [];

    return NextResponse.json({
      spaces: spacesWithChildren,
    });
  } catch (error) {
    console.error("Unexpected error in spaces API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
