import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspace/[workspaceId]/train-tawos/[trainingRunId]/status
 *
 * Polling endpoint for TAWOS training progress.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; trainingRunId: string }> }
) {
  const { workspaceId, trainingRunId } = await params;

  // Auth check
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve workspace (RLS handles access control)
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("workspace_id", workspaceId)
    .single();

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Fetch training run — RLS ensures user can only see runs in their workspace
  const { data: run, error } = await (supabase.from("tawos_training_runs" as any) as any)
    .select(
      "id, status, total_issues, processed, failed, duplicate_in_file, duplicate_in_db, " +
      "new_count, progress_message, result, error_message, started_at, completed_at"
    )
    .eq("id", trainingRunId)
    .eq("workspace_id", workspace.id)
    .single();

  if (error || !run) {
    return NextResponse.json({ error: "Training run not found" }, { status: 404 });
  }

  const totalToProcess = run.new_count || run.total_issues || 0;
  const processed = (run.processed || 0) + (run.failed || 0);
  const progress = totalToProcess > 0
    ? Math.round((processed / totalToProcess) * 100)
    : run.status === "completed" ? 100 : 0;

  const response: Record<string, unknown> = {
    status: run.status,
    progress,
    totalIssues: run.total_issues,
    processed: run.processed,
    failed: run.failed,
    duplicateInFile: run.duplicate_in_file,
    duplicateInDB: run.duplicate_in_db,
    newCount: run.new_count,
    progressMessage: run.progress_message || null,
    startedAt: run.started_at || null,
    completedAt: run.completed_at || null,
  };

  if (run.status === "completed") {
    response.result = run.result || null;
  }

  if (run.status === "failed") {
    response.error = run.error_message || "Training failed";
  }

  return NextResponse.json(response);
}
