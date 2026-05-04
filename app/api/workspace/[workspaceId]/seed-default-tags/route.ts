import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { prepareDefaultTagsForInsert, DEFAULT_TAGS } from "@/lib/default-tags";
import { verifyCsrfToken } from "@/lib/csrf-protection";

/**
 * POST /api/workspace/[workspaceId]/seed-default-tags
 *
 * Seeds default tags for a workspace if they don't already exist.
 * Only adds tags that are missing (won't duplicate existing ones).
 */
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
    const supabase = await createClient();

    // Get authenticated user
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up workspace and verify ownership
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, owner_id")
      .eq("workspace_id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (workspace.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Only workspace owners can seed default tags" },
        { status: 403 }
      );
    }

    const internalWorkspaceId = workspace.id;

    // Get existing tags for this workspace
    const { data: existingTags, error: existingTagsError } = await supabase
      .from("tags")
      .select("name")
      .eq("workspace_id", internalWorkspaceId)
      .is("deleted_at", null);

    if (existingTagsError) {
      console.error("Error fetching existing tags:", existingTagsError);
      return NextResponse.json(
        { error: "Failed to fetch existing tags" },
        { status: 500 }
      );
    }

    // Get names of existing tags
    const existingTagNames = new Set(
      existingTags?.map((tag) => tag.name.toLowerCase()) || []
    );

    // Filter out tags that already exist
    const defaultTags = prepareDefaultTagsForInsert(internalWorkspaceId);
    const tagsToInsert = defaultTags.filter(
      (tag) => !existingTagNames.has(tag.name.toLowerCase())
    );

    if (tagsToInsert.length === 0) {
      return NextResponse.json({
        message: "All default tags already exist",
        added: 0,
        skipped: defaultTags.length,
      });
    }

    // Insert the missing tags
    const { error: insertError } = await supabase
      .from("tags")
      .insert(tagsToInsert);

    if (insertError) {
      console.error("Error inserting default tags:", insertError);
      return NextResponse.json(
        { error: "Failed to insert default tags" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Default tags seeded successfully",
      added: tagsToInsert.length,
      skipped: defaultTags.length - tagsToInsert.length,
      tags: tagsToInsert.map((t) => t.name),
    });
  } catch (error) {
    console.error("Unexpected error in seed-default-tags API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workspace/[workspaceId]/seed-default-tags
 *
 * Returns the list of default tags that would be seeded.
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up workspace and verify ownership
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, owner_id")
      .eq("workspace_id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (workspace.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const internalWorkspaceId = workspace.id;

    // Get existing tags for this workspace
    const { data: existingTags } = await supabase
      .from("tags")
      .select("name")
      .eq("workspace_id", internalWorkspaceId)
      .is("deleted_at", null);

    const existingTagNames = new Set(
      existingTags?.map((tag) => tag.name.toLowerCase()) || []
    );

    // Calculate which tags are missing
    const missingTags = DEFAULT_TAGS.filter(
      (tag) => !existingTagNames.has(tag.name.toLowerCase())
    );

    return NextResponse.json({
      totalDefaultTags: DEFAULT_TAGS.length,
      existingCount: existingTags?.length || 0,
      missingCount: missingTags.length,
      missingTags: missingTags.map((t) => ({ name: t.name, color: t.color, category: t.category })),
      allDefaultTags: DEFAULT_TAGS,
    });
  } catch (error) {
    console.error("Unexpected error in seed-default-tags API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
