/**
 * User Workspace API
 *
 * GET /api/user/workspace
 *
 * Returns the current user's primary workspace (owned or member).
 * Used to determine routing for beta users and other flows.
 */

import { NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: ownedWorkspace } = await supabase
      .from("workspaces")
      .select("workspace_id, name")
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (ownedWorkspace) {
      return NextResponse.json({
        workspaceId: ownedWorkspace.workspace_id,
        workspaceName: ownedWorkspace.name,
        role: "owner",
      });
    }

    return NextResponse.json({ workspaceId: null });
  } catch (error) {
    console.error("Error fetching user workspace:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspace" },
      { status: 500 }
    );
  }
}
