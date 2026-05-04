import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { saveGeneratedTasks, GeneratedTaskInput } from "@/lib/services/taskSaveService";
import { verifyCsrfToken } from "@/lib/csrf-protection";

/**
 * POST /api/tasks/save-generated
 *
 * Unified endpoint for saving AI-generated tasks.
 * Uses the taskSaveService which handles ID resolution automatically.
 */
export async function POST(req: NextRequest) {
  try {
    // =========================================================================
    // 0. VERIFY CSRF TOKEN
    // =========================================================================
    const csrfValid = await verifyCsrfToken(req);
    if (!csrfValid) {
      return NextResponse.json(
        { error: "Invalid CSRF token" },
        { status: 403 }
      );
    }

    // 1. Create Supabase client
    const supabase = await createClient();

    // 2. Authenticate user
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 3. Parse request body
    const body = await req.json();
    const {
      tasks,
      projectId,
      generationSessionId,
      sprintId,
    } = body;

    // 4. Validate required fields
    if (!tasks || !Array.isArray(tasks)) {
      return NextResponse.json(
        { error: "tasks array is required" },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // 5. Transform to GeneratedTaskInput format if needed
    // Supports both camelCase and snake_case field names
    const normalizedTasks: GeneratedTaskInput[] = tasks.map((task: any) => ({
      title: task.title || task.name,
      description: task.description,
      storyText: task.storyText || task.story_text,
      acceptanceCriteria: task.acceptanceCriteria || task.acceptance_criteria,
      storyPoints: task.storyPoints || task.story_points,
      priority: task.priority,
      estimatedHours: task.estimatedHours || task.estimated_hours,
      assigneeId: task.assigneeId || task.assignee_id,
    }));

    // 6. Save using unified service
    const result = await saveGeneratedTasks(supabase, normalizedTasks, {
      projectId,
      userId: user.id,
      generationSessionId,
      sprintId,
    });

    // 7. Update the story_generation_session with the generated task IDs
    if (generationSessionId && result.success && result.savedTasks.length > 0) {
      const savedTaskIds = result.savedTasks.map((task: any) => task.id);
      const { error: sessionUpdateError } = await supabase
        .from("story_generation_sessions")
        .update({
          generated_story_ids: savedTaskIds,
        })
        .eq("id", generationSessionId);

      if (sessionUpdateError) {
        // Non-critical error - tasks are saved, just session link is missing
      } else {
      }
    }

    // 8. Return result
    if (result.success) {
      return NextResponse.json({
        success: true,
        savedCount: result.savedCount,
        tasks: result.savedTasks,
        context: result.context,
        generationSessionId,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.errors?.join(", ") || "Failed to save tasks",
          errors: result.errors,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[API] save-generated error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
