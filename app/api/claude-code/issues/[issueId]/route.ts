import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";

export async function PATCH(
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

    // Verify issue exists
    const { data: issue, error: fetchError } = await supabase
      .from("claude_code_issues")
      .select("id, workspace_id")
      .eq("id", issueId)
      .single();

    if (fetchError || !issue) {
      return NextResponse.json(
        { error: "Issue not found" },
        { status: 404 }
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

    // Dismiss the issue
    const { data: updated, error: updateError } = await supabase
      .from("claude_code_issues")
      .update({
        status: "dismissed",
        dismissed_by: user.id,
        dismissed_at: new Date().toISOString(),
      })
      .eq("id", issueId)
      .select()
      .single();

    if (updateError) {
      console.error("Error dismissing issue:", updateError);
      return NextResponse.json(
        { error: "Failed to dismiss issue" },
        { status: 500 }
      );
    }

    return NextResponse.json({ issue: updated });
  } catch (error) {
    console.error("Dismiss issue error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
