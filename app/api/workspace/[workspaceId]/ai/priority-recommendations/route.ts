import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { verifyCsrfToken } from "@/lib/csrf-protection";
import { withRateLimit } from "@/lib/rate-limit-v2";
import {
  getCachedAIResponse,
  generateCacheKey,
  CACHE_PREFIXES,
} from "@/lib/ai-cache-service";
import { enqueuePriorityRecommendations, stripMarkdownCodeBlock } from "@/lib/dashboard-worker";

// Route segment config
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Types
interface TaskContext {
  id: string;
  task_id: string;
  title: string;
  description: string | null | undefined;
  priority: string | null | undefined;
  story_points: number | null | undefined;
  business_value: number | null | undefined;
  user_impact: number | null | undefined;
  complexity: number | null | undefined;
  risk: number | null | undefined;
}

interface ApplyRequest {
  recommendations: Array<{
    id: string;
    priority: "critical" | "high" | "medium" | "low";
    confidence?: number;
    reasoning?: string;
  }>;
}

/**
 * GET /api/workspace/[workspaceId]/ai/priority-recommendations
 * Generate AI-powered priority recommendations for tasks.
 *
 * Cache hit  → 200 with full data
 * Cache miss → enqueue to ai-fast queue → 202 with { taskId }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;

  // Verify authentication
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve workspace and verify ownership
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, workspace_id, owner_id")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single();

  if (workspaceError || !workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (workspace.owner_id !== user.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const sprintId = searchParams.get("sprintId");

  try {
    // Build query to fetch tasks using internal workspace UUID
    // Only fetch "To Do" tasks (not-started status type, excluding Backlog)
    let query = supabase
      .from("tasks")
      .select(`
        id,
        task_id,
        name,
        description,
        priority,
        story_points,
        business_value,
        user_impact,
        complexity,
        risk,
        status:statuses!inner(
          name,
          status_type:status_types!inner(name)
        )
      `)
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .eq("statuses.status_types.name", "not-started")
      .not("statuses.name", "ilike", "%backlog%");

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    if (sprintId) {
      query = query.eq("sprint_id", sprintId);
    }

    const MAX_TASKS = 50;
    const { data: tasks, error: tasksError } = await query.limit(MAX_TASKS);

    if (tasksError) {
      console.error("[Priority Recommendations] Error fetching tasks:", tasksError);
      return NextResponse.json(
        { error: "Failed to fetch tasks" },
        { status: 500 }
      );
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          recommendations: [],
          analyzed_at: new Date().toISOString(),
          task_count: 0,
        },
      });
    }

    // Prepare task context for AI analysis
    const taskContext: TaskContext[] = tasks.map((task) => ({
      id: task.id,
      task_id: task.task_id,
      title: task.name,
      description: task.description,
      priority: task.priority,
      story_points: task.story_points,
      business_value: task.business_value,
      user_impact: task.user_impact,
      complexity: task.complexity,
      risk: task.risk,
    }));

    // Build cache key (same as worker uses)
    const taskIds = taskContext.map((t) => t.id).sort().join(",");
    const taskContentHash = taskContext
      .map((t) => `${t.id}:${t.title}:${t.description || ""}:${t.priority || ""}`)
      .sort()
      .join("|");
    const cacheKey = generateCacheKey(
      CACHE_PREFIXES.PRIORITY_RECOMMENDATION,
      taskContentHash,
      { workspaceId: workspace.id, taskIds }
    );

    // Check cache synchronously — cache hit returns immediately
    const cached = await getCachedAIResponse(cacheKey);
    if (cached) {
      // Parse the cached AI text
      const jsonText = stripMarkdownCodeBlock(cached.text);

      let recommendations;
      try {
        recommendations = JSON.parse(jsonText);
        if (!Array.isArray(recommendations)) {
          throw new Error("Cached AI response is not an array");
        }
      } catch {
        // Corrupted cache entry — fall through to live computation
        console.error("[Priority Recommendations] Corrupted cache entry, falling through to enqueue");
        recommendations = null;
      }

      if (!recommendations) {
        // Skip cache-hit path, fall through to enqueue below
      } else {

      // Normalize recommendations
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recommendations = recommendations.map((rec: any) => ({
        id: rec.id,
        task_id: rec.task_id,
        title: rec.title,
        current_priority: rec.current_priority,
        recommended_priority: rec.recommended_priority || "medium",
        confidence: typeof rec.confidence === "number" ? rec.confidence : 0.5,
        reasoning: rec.reasoning || "No reasoning provided",
        factors: {
          business_value: rec.factors?.business_value || 50,
          user_impact: rec.factors?.user_impact || 50,
          complexity: rec.factors?.complexity || 50,
          risk: rec.factors?.risk || 50,
          dependencies: rec.factors?.dependencies || 50,
        },
      }));

      return NextResponse.json({
        success: true,
        data: {
          recommendations,
          analyzed_at: new Date().toISOString(),
          task_count: tasks.length,
        },
      });
      }
    }

    // Cache miss → enqueue to ai-fast queue
    const { taskId } = await enqueuePriorityRecommendations({
      tasks: taskContext,
      workspaceId: workspace.id,
      userId: user.id,
      projectId: projectId || undefined,
      sprintId: sprintId || undefined,
    });

    return NextResponse.json({ taskId }, { status: 202 });
  } catch (error) {
    console.error("[Priority Recommendations] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate recommendations",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspace/[workspaceId]/ai/priority-recommendations
 * Apply accepted AI priority recommendations to tasks
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  // Verify CSRF token
  const csrfValid = await verifyCsrfToken(request);
  if (!csrfValid) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    );
  }

  const { workspaceId } = await params;

  // Verify authentication
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting - AI operation
  const rateLimitResponse = await withRateLimit(
    request,
    'ai_standard',
    'user',
    user.id
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Resolve workspace to get internal UUID
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, workspace_id")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single();

  if (workspaceError || !workspace) {
    console.error("[Priority Recommendations] Workspace not found:", workspaceError);
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Parse request body
  let body: ApplyRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { recommendations } = body;

  if (!recommendations || !Array.isArray(recommendations) || recommendations.length === 0) {
    return NextResponse.json(
      { error: "At least one recommendation is required" },
      { status: 400 }
    );
  }

  try {
    const updates: Array<{ id: string; success: boolean; error?: string }> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedTasks: any[] = [];

    // Process each recommendation
    for (const rec of recommendations) {
      try {
        // Update priority on the task itself
        const { data: task, error: updateError } = await supabase
          .from("tasks")
          .update({
            priority: rec.priority,
            updated_at: new Date().toISOString(),
          })
          .eq("id", rec.id)
          .eq("workspace_id", workspace.id)
          .select()
          .single();

        if (updateError) {
          updates.push({
            id: rec.id,
            success: false,
            error: updateError.message,
          });
        } else {
          // Upsert AI priority metadata into separate table
          const { error: metaError } = await supabase
            .from("task_ai_metadata")
            .upsert({
              task_id: rec.id,
              ai_priority_applied: true,
              ai_priority_applied_at: new Date().toISOString(),
              ai_priority_confidence: rec.confidence || null,
              ai_priority_reasoning: rec.reasoning || null,
              updated_at: new Date().toISOString(),
            }, { onConflict: "task_id" });

          if (metaError) {
            console.error("Error saving AI priority metadata:", metaError);
          }

          updates.push({ id: rec.id, success: true });
          updatedTasks.push(task);
        }
      } catch (err) {
        updates.push({
          id: rec.id,
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const successCount = updates.filter((u) => u.success).length;
    const failedCount = updates.filter((u) => !u.success).length;

    return NextResponse.json({
      success: true,
      message: `Applied priorities to ${successCount} tasks`,
      data: {
        updated: successCount,
        failed: failedCount,
        updates: updatedTasks,
        details: updates,
      },
    });
  } catch (error) {
    console.error("[Priority Recommendations] Error applying:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to apply recommendations",
      },
      { status: 500 }
    );
  }
}
