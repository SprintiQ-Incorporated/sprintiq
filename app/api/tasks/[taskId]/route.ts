import { type NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import type { AITaskQueueRow } from "@/types/database/ai-task-queue";
import type { TaskStatusEnvelope } from "@/types/api/task-queue";

const TERMINAL_STATUSES = new Set(["complete", "failed", "dead_lettered"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    // Auth — no CSRF on GET
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch row — RLS enforces workspace scoping
    const { data: row, error } = await supabase
      .from("ai_task_queue")
      .select("*")
      .eq("id", taskId)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const task = row as unknown as AITaskQueueRow;

    const envelope: TaskStatusEnvelope = {
      taskId: task.id,
      status: task.status,
      queue: task.queue,
      task_type: task.task_type,
      source: task.source,
      created_at: task.created_at,
      started_at: task.started_at,
      completed_at: task.completed_at,
      failed_at: task.failed_at,
      result: task.result,
      result_meta: task.result_meta,
      error: task.error_message,
    };

    // Cache-Control: no-store for in-flight, cacheable for terminal
    const isTerminal = TERMINAL_STATUSES.has(task.status);
    const cacheControl = isTerminal
      ? "public, max-age=300, s-maxage=300, stale-while-revalidate=60"
      : "no-store";

    return NextResponse.json(envelope, {
      headers: { "Cache-Control": cacheControl },
    });
  } catch (error) {
    console.error("[tasks/poll] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
