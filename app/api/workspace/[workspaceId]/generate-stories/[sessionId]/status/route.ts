import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspace/[workspaceId]/generate-stories/[sessionId]/status
 *
 * Polling endpoint for story generation progress.
 * Returns session status, progress percentage, and generated stories when complete.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; sessionId: string }> }
) {
  const { workspaceId, sessionId } = await params;

  // Auth check
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look up workspace to verify membership (RLS handles access control)
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("workspace_id", workspaceId)
    .single();

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Fetch session — RLS ensures user can only see sessions in their workspace
  const { data: session, error } = await supabase
    .from("story_generation_sessions")
    .select(
      "id, status, progress, progress_message, generated_stories, error_message, " +
      "team_recommendation, ai_model, generation_time_ms, completed_at"
    )
    .eq("id", sessionId)
    .eq("workspace_id", workspace.id)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Cast to any — new columns (progress, generated_stories, etc.) aren't in generated Supabase types yet
  const s = session as any;

  const response: Record<string, unknown> = {
    status: s.status,
    progress: s.progress ?? 0,
    progressMessage: s.progress_message || null,
  };

  if (s.status === "completed") {
    response.stories = s.generated_stories || [];
    response.teamRecommendation = s.team_recommendation || null;
    response.aiModel = s.ai_model || null;
    response.duration = s.generation_time_ms || null;
  }

  if (s.status === "failed") {
    response.error = s.error_message || "Generation failed";
  }

  return NextResponse.json(response);
}
