import { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveProjectId,
  getOrCreateBacklogStatus,
} from "@/lib/utils/id-lookup";

// ============================================================================
// TYPES
// ============================================================================

export interface GeneratedTaskInput {
  title: string;
  description?: string;
  storyText?: string;
  acceptanceCriteria?: string[];
  storyPoints?: number;
  priority?: "low" | "medium" | "high" | "critical";
  estimatedHours?: number;
  assigneeId?: string;
}

export interface SaveTasksContext {
  projectId: string;        // Can be friendly ID or UUID - will be resolved
  workspaceId?: string;     // Optional - derived from project if not provided
  spaceId?: string;         // Optional - derived from project if not provided
  userId: string;           // Required - created_by
  generationSessionId?: string;
  sprintId?: string;
}

export interface SaveTasksResult {
  success: boolean;
  savedTasks: any[];
  savedCount: number;
  context: {
    projectId: string;
    workspaceId: string;
    spaceId: string;
  };
  errors?: string[];
}

// ============================================================================
// HELPERS
// ============================================================================

const VALID_PRIORITIES = new Set(["critical", "high", "medium", "low", "none"]);

function normalizePriority(priority?: string): string {
  const normalized = (priority || "medium").toLowerCase();
  return VALID_PRIORITIES.has(normalized) ? normalized : "medium";
}

function validateContext(context: SaveTasksContext): void {
  if (!context.projectId) {
    throw new Error("projectId is required");
  }
  if (!context.userId) {
    throw new Error("userId is required");
  }
}

// ============================================================================
// MAIN SERVICE FUNCTION
// ============================================================================

export async function saveGeneratedTasks(
  supabase: SupabaseClient,
  tasks: GeneratedTaskInput[],
  context: SaveTasksContext
): Promise<SaveTasksResult> {
  // 1. Validate input
  validateContext(context);

  if (!tasks || tasks.length === 0) {
    return {
      success: true,
      savedTasks: [],
      savedCount: 0,
      context: {
        projectId: context.projectId,
        workspaceId: context.workspaceId || "",
        spaceId: context.spaceId || "",
      },
    };
  }

  // 2. Resolve all IDs to internal UUIDs using id-lookup utilities
  let projectUUID: string;
  let spaceUUID: string;
  let workspaceUUID: string;

  try {
    // Resolve project - this also gives us space and workspace UUIDs
    const projectInfo = await resolveProjectId(supabase, context.projectId);
    projectUUID = projectInfo.projectUUID;
    spaceUUID = projectInfo.spaceUUID;
    workspaceUUID = projectInfo.workspaceUUID;
  } catch (error) {
    return {
      success: false,
      savedTasks: [],
      savedCount: 0,
      context: {
        projectId: context.projectId,
        workspaceId: "",
        spaceId: "",
      },
      errors: [`ID resolution failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  // 3. Get or create Backlog status for the space
  // This ensures AI-generated stories always go to Backlog
  const statusContext = await getOrCreateBacklogStatus(supabase, spaceUUID, workspaceUUID);
  const backlogStatusId = statusContext?.statusUUID;

  if (!backlogStatusId) {
    return {
      success: false,
      savedTasks: [],
      savedCount: 0,
      context: { projectId: projectUUID, workspaceId: workspaceUUID, spaceId: spaceUUID },
      errors: ["Could not find or create Backlog status for the space"],
    };
  }


  // 4. Transform tasks to database format (excluding skills - handled separately via junction table)
  const tasksToInsert = tasks.map((task, index) => {
    // Use description/storyText as-is; AC is stored in the dedicated acceptance_criteria column
    // to avoid data desync when the description is edited
    const description = task.description || task.storyText || "";

    return {
      name: task.title,
      description,
      project_id: projectUUID,
      workspace_id: workspaceUUID,
      space_id: spaceUUID,
      status_id: backlogStatusId,
      story_points: task.storyPoints || 0,
      priority: normalizePriority(task.priority),
      estimated_time: task.estimatedHours || null,
      assignee_id: task.assigneeId || null,
      generated_by_ai: true,
      sprint_id: context.sprintId || null,
      created_by: context.userId,
      position: index,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Store acceptance criteria in dedicated column for AC Compliance tracking
      acceptance_criteria: task.acceptanceCriteria?.length ? task.acceptanceCriteria : null,
    };
  });

  // 5. Log for debugging

  // 6. Insert tasks
  const { data: savedTasks, error } = await supabase
    .from("tasks")
    .insert(tasksToInsert)
    .select();

  if (error) {
    console.error("[taskSaveService] Insert error:", error);
    return {
      success: false,
      savedTasks: [],
      savedCount: 0,
      context: { projectId: projectUUID, workspaceId: workspaceUUID, spaceId: spaceUUID },
      errors: [error.message],
    };
  }

  // 7. Insert task_ai_metadata for generated tasks (generation_session_id tracking)
  if (savedTasks && context.generationSessionId) {
    const metadataRows = savedTasks.map((task) => ({
      task_id: task.id,
      generation_session_id: context.generationSessionId!,
    }));

    const { error: metaError } = await supabase
      .from("task_ai_metadata")
      .insert(metadataRows);

    if (metaError) {
      console.error("[taskSaveService] AI metadata insert error:", metaError);
    }
  }

  return {
    success: true,
    savedTasks: savedTasks || [],
    savedCount: savedTasks?.length || 0,
    context: {
      projectId: projectUUID,
      workspaceId: workspaceUUID,
      spaceId: spaceUUID,
    },
  };
}

// ============================================================================
// CONVENIENCE FUNCTION FOR DIRECT PROJECT CONTEXT
// ============================================================================

export async function saveTasksToProject(
  supabase: SupabaseClient,
  tasks: GeneratedTaskInput[],
  projectId: string,
  userId: string,
  options?: {
    generationSessionId?: string;
    sprintId?: string;
  }
): Promise<SaveTasksResult> {
  return saveGeneratedTasks(supabase, tasks, {
    projectId,
    userId,
    ...options,
  });
}
