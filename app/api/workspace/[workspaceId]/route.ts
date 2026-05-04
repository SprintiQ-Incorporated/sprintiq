import { createClient, getAuthUser } from "@/lib/supabase/server";
import { verifyCsrfToken } from "@/lib/csrf-protection";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(255),
});

/**
 * PATCH /api/workspace/[workspaceId]
 *
 * Owner-only update of workspace name. Other workspace fields are not editable
 * via this endpoint to keep the surface narrow.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const csrfValid = await verifyCsrfToken(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
    }

    const { workspaceId } = await params;
    const supabase = await createClient();

    const { user } = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

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
        { error: "Only the workspace owner can rename the workspace" },
        { status: 403 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("workspaces")
      .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
      .eq("id", workspace.id)
      .select("id, workspace_id, name")
      .single();

    if (updateError || !updated) {
      console.error("Workspace rename failed:", updateError);
      return NextResponse.json(
        { error: "Failed to update workspace" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, workspace: updated });
  } catch (error) {
    console.error("Workspace PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
