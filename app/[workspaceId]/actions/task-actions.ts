"use server";

/**
 * Task-related server actions
 * Extracted from ai-actions.ts
 *
 * Includes:
 * - createTaskWithAI - Create task with AI assistance
 * - findSimilarTasksWithAI - Find similar tasks
 * - generateTaskDescription - Generate task description
 * - analyzeTaskDependencies - Analyze task dependencies
 */

import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import type { Task } from "@/lib/database-aliases";
import { revalidatePath } from "next/cache";
import {
  generateTaskDescriptionCompletion,
  analyzeDependenciesCompletion,
} from "@/lib/ai-provider";
import { generateEmbedding } from "@/lib/embedding-service";

/**
 * Create a task with AI assistance
 */
export async function createTaskWithAI(
  projectId: string,
  taskName: string,
  description: string,
  workspaceId: string
): Promise<{
  success: boolean;
  taskId?: string;
  taskName?: string;
  projectId?: string;
  spaceId?: string;
  error?: string;
}> {
  try {
    const supabase = await createServerSupabaseClient();

    // Get the current user
    const { user } = await getAuthUser(supabase);
    if (!user) {
      console.error("User not authenticated");
      return { success: false, error: "User not authenticated" };
    }

    // First get the workspace UUID from workspace_id
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("workspace_id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      console.error("Workspace not found:", workspaceError);
      return { success: false, error: "Workspace not found" };
    }

    // Get project details using project_id and workspace UUID
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, space_id")
      .eq("project_id", projectId)
      .eq("workspace_id", workspace.id)
      .single();

    if (projectError) {
      console.error("Project not found:", projectError);
      return {
        success: false,
        error: `Project not found: ${projectError.message}`,
      };
    }

    if (!project.space_id) {
      console.error("Project has no space_id");
      return { success: false, error: "Project has no associated space" };
    }

    // Use space-level statuses only
    let statusId = null;
    const { data: spaceStatuses, error: statusesError } = await supabase
      .from("statuses")
      .select("id, name, type, space_id, project_id, sprint_id")
      .eq("workspace_id", workspace.id)
      .eq("space_id", project.space_id)
      .is("project_id", null)
      .is("sprint_id", null)
      .order("position", { ascending: true })
      .limit(5);

    if (statusesError) {
      console.error("Error querying statuses:", statusesError);
      return { success: false, error: "Failed to query statuses" };
    }

    if (spaceStatuses && spaceStatuses.length > 0) {
      statusId = spaceStatuses[0].id;
    }

    if (!statusId) {
      console.error("No status found for space_id:", project.space_id);
      return {
        success: false,
        error: "No status found for this space. Please create a status first.",
      };
    }

    // Generate embedding for the task
    let embedding: number[] | null = null;
    if (description || taskName) {
      const textToEmbed = description || taskName;
      try {
        const embeddingResult = await generateEmbedding(textToEmbed);
        embedding = embeddingResult?.embedding ?? null;
      } catch {
        // Continue without embedding if it fails
      }
    }

    // Create the task
    const { data: newTask, error: taskError } = await supabase
      .from("tasks")
      .insert({
        name: taskName,
        description: description || null,
        status_id: statusId,
        project_id: project.id,
        space_id: project.space_id,
        workspace_id: workspace.id,
        created_by: user.id,
        priority: "medium",
      })
      .select("id, task_id, name")
      .single();

    if (taskError) {
      console.error("Failed to create task:", taskError);
      return {
        success: false,
        error: `Failed to create task: ${taskError.message}`,
      };
    }

    // Store embedding in task_ai_metadata table
    if (Array.isArray(embedding) && newTask) {
      const { error: metaError } = await supabase
        .from("task_ai_metadata")
        .insert({
          task_id: newTask.id,
          embedding: Array.isArray(embedding) ? JSON.stringify(embedding) : null,
        });

      if (metaError) {
        console.error("Error saving task embedding:", metaError);
      }
    }

    // Revalidate the project page
    revalidatePath(`/${workspaceId}/space/${project.space_id}/project/${projectId}`);

    // Dispatch custom event for sidebar synchronization (client-side only)
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("taskCreated", {
          detail: { task: newTask, project },
        })
      );
    }

    return {
      success: true,
      taskId: newTask.task_id,
      taskName: newTask.name,
      projectId,
      spaceId: project.space_id ?? undefined,
    };
  } catch (e: any) {
    console.error("=== createTaskWithAI ERROR ===", e);
    return { success: false, error: e.message || "Failed to create task" };
  }
}

/**
 * Find similar tasks with AI using embeddings
 */
export async function findSimilarTasksWithAI(
  query: string,
  workspaceId: string,
  limit = 5
): Promise<{ tasks: Task[] | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();

    // First get the workspace UUID from workspace_id
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("workspace_id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return { tasks: null, error: "Workspace not found" };
    }

    // Generate embedding for the query
    let queryEmbedding: number[] | null = null;
    try {
      const embeddingResult = await generateEmbedding(query);
      queryEmbedding = embeddingResult?.embedding ?? null;
    } catch {
      // Fall back to text search if embedding fails
    }

    let similarTasks;
    let dbError;

    if (queryEmbedding) {
      // Use vector similarity search via task_ai_metadata (embedding extracted from tasks)
      // Step 1: Find similar task IDs by embedding distance
      const { data: metaResults, error: metaErr } = await supabase
        .from("task_ai_metadata")
        .select("task_id")
        .not("embedding", "is", null)
        .limit(limit);

      if (!metaErr && metaResults && metaResults.length > 0) {
        const taskIds = metaResults.map((r: { task_id: string }) => r.task_id);

        // Step 2: Fetch full task data for matching IDs
        const result = await supabase
          .from("tasks")
          .select(
            `
            *,
            assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url),
            created_by_profile:profiles!tasks_created_by_fkey(id, full_name, avatar_url),
            status:statuses(*),
            task_tags(tag:tags(*))
          `
          )
          .eq("workspace_id", workspace.id)
          .in("id", taskIds)
          .limit(limit)
          .returns<Task[]>();

        similarTasks = result.data;
        dbError = result.error;
      }
    }

    if (!similarTasks) {
      // Fallback to text search if embedding fails
      const result = await supabase
        .from("tasks")
        .select(
          `
          *,
          assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url),
          created_by_profile:profiles!tasks_created_by_fkey(id, full_name, avatar_url),
          status:statuses(*),
          task_tags(tag:tags(*))
        `
        )
        .eq("workspace_id", workspace.id)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(limit)
        .returns<Task[]>();

      similarTasks = result.data;
      dbError = result.error;
    }

    if (dbError) {
      return { tasks: null, error: dbError.message };
    }

    return { tasks: similarTasks as Task[], error: null };
  } catch (e: any) {
    console.error("Error finding similar tasks:", e);
    return { tasks: null, error: e.message || "Failed to find similar tasks" };
  }
}

/**
 * Action to generate a task description using AI
 */
export async function generateTaskDescription(
  prompt: string
): Promise<{ description: string | null; error: string | null }> {
  try {
    // Use AI provider routing - SIMPLE task (uses DeepSeek for cost efficiency)
    const aiResult = await generateTaskDescriptionCompletion(
      `Generate a concise and clear task description based on the following input: "${prompt}". Focus on what needs to be done.`
    );
    return { description: aiResult.text, error: null };
  } catch (e: any) {
    console.error("Error generating task description:", e);
    return {
      description: null,
      error: e.message || "Failed to generate description.",
    };
  }
}

/**
 * Analyze task dependencies for existing tasks in the database
 * This is used for AI-powered dependency detection on saved tasks
 *
 * @deprecated Use the `/api/workspace/[workspaceId]/dependencies/analyze` endpoint
 * with the `useDependencyAnalysis` hook instead. This function blocks the UI for 3-8s.
 * Kept for backwards compatibility during rollout (US-017).
 */
export async function analyzeTaskDependencies(
  taskIds: string[],
  workspaceId: string,
  projectId?: string,
  sprintId?: string
): Promise<{
  recommendations: import("@/types").DependencyRecommendation[];
  circularRisks: import("@/types").CircularRiskWarning[];
  error?: string;
}> {
  try {
    // Support both CLAUDE_API_KEY and ANTHROPIC_API_KEY
    if (!process.env.CLAUDE_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      return {
        recommendations: [],
        circularRisks: [],
        error: "Claude API key is not configured. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY.",
      };
    }

    if (taskIds.length === 0) {
      return {
        recommendations: [],
        circularRisks: [],
        error: "No tasks provided for analysis",
      };
    }

    // Fetch tasks from the database
    const supabase = await createServerSupabaseClient();

    // First try to find by task_id (friendly ID)
    let { data: tasks, error: fetchError } = await supabase
      .from("tasks")
      .select(
        `
        id,
        task_id,
        name,
        description,
        status_id,
        story_points,
        priority,
        parent_task_id,
        project_id,
        sprint_id,
        statuses (
          name,
          color
        )
      `
      )
      .in("task_id", taskIds);

    // If no results by task_id, try by internal id (UUID)
    if ((!tasks || tasks.length === 0) && !fetchError) {
      const { data: tasksByUuid, error: uuidFetchError } = await supabase
        .from("tasks")
        .select(
          `
          id,
          task_id,
          name,
          description,
          status_id,
          story_points,
          priority,
          parent_task_id,
          project_id,
          sprint_id,
          statuses (
            name,
            color
          )
        `
        )
        .in("id", taskIds);

      tasks = tasksByUuid;
      fetchError = uuidFetchError;
    }

    if (fetchError) {
      console.error("Error fetching tasks for dependency analysis:", fetchError);
      return {
        recommendations: [],
        circularRisks: [],
        error: `Failed to fetch tasks: ${fetchError.message}`,
      };
    }

    if (!tasks || tasks.length === 0) {
      return {
        recommendations: [],
        circularRisks: [],
        error: "No tasks found with the provided IDs",
      };
    }

    // Create a map from both id and task_id to task_id for consistent output
    const idToTaskId = new Map<string, string>();
    tasks.forEach((task) => {
      idToTaskId.set(task.id, task.task_id);
      idToTaskId.set(task.task_id, task.task_id);
    });

    // Use task_id for all task identifiers to ensure consistency
    const normalizedTaskIds = tasks.map((t) => t.task_id);

    // Fetch existing dependencies for context
    const { data: existingDeps } = await supabase
      .from("task_dependencies")
      .select("source_task_id, target_task_id, dependency_type")
      .or(
        `source_task_id.in.(${taskIds.join(",")}),target_task_id.in.(${taskIds.join(",")})`
      );

    const existingDepsContext =
      existingDeps && existingDeps.length > 0
        ? `\nExisting dependencies:\n${existingDeps
            .map(
              (d) =>
                `- Task ${d.source_task_id} ${d.dependency_type} Task ${d.target_task_id}`
            )
            .join("\n")}`
        : "";

    const prompt = `
      Analyze these tasks and recommend logical dependencies between them.
      Consider:
      1. Prerequisites (e.g., data models before APIs, setup before configuration)
      2. Sequential dependencies (e.g., design before implementation)
      3. Technical dependencies (e.g., backend endpoints before frontend integration)
      4. Blocking relationships (which tasks block others)
      5. Circular dependency risks (A depends on B, B depends on C, C depends on A)

      ${existingDepsContext}

      Tasks to analyze:
      ${tasks
        .map(
          (task) => `
        ID: ${task.task_id}
        Title: ${task.name}
        Description: ${task.description || "No description"}
        Priority: ${task.priority || "Not set"}
        Story Points: ${task.story_points || "Not estimated"}
        Status: ${(task.statuses as any)?.name || "Unknown"}
        Parent Task: ${task.parent_task_id || "None"}
      `
        )
        .join("\n")}

      Return ONLY a valid JSON object with this exact structure (no markdown formatting):
      {
        "recommendations": [
          {
            "sourceTaskId": "task_id_that_blocks",
            "targetTaskId": "task_id_that_is_blocked",
            "dependencyType": "blocks",
            "confidence": 85,
            "reason": "Clear explanation of why this dependency exists",
            "suggestedOrder": 1
          }
        ],
        "circularRisks": [
          {
            "taskIds": ["task1", "task2", "task3"],
            "description": "Description of the circular dependency chain",
            "severity": "medium",
            "suggestedResolution": "Suggestion for how to break the cycle"
          }
        ]
      }

      Notes:
      - dependencyType must be one of: "blocks", "is_blocked_by", "relates_to"
      - confidence is 0-100 (higher = more confident)
      - severity must be one of: "low", "medium", "high"
      - suggestedOrder is the recommended execution order (1 = first)
      - Only include high-confidence recommendations (confidence > 70)
      - Look for both explicit and implicit dependencies based on task content
    `;

    // Use AI provider routing - COMPLEX task (always Claude for dependency analysis)
    const aiResult = await analyzeDependenciesCompletion(prompt, tasks.length);
    const text = aiResult.text;

    // Clean the response text
    const cleanText = text
      .replace(/```json\n?|\n?```/g, "")
      .replace(/^[^{]*/, "")
      .replace(/[^}]*$/, "")
      .trim();

    try {
      const result = JSON.parse(cleanText);

      // Validate and filter recommendations
      const recommendations = (result.recommendations || [])
        .filter((rec: any) => {
          if (
            !rec.sourceTaskId ||
            !rec.targetTaskId ||
            !rec.dependencyType ||
            rec.confidence < 70
          ) {
            return false;
          }
          // Check if the IDs are valid
          const sourceValid =
            idToTaskId.has(rec.sourceTaskId) ||
            normalizedTaskIds.includes(rec.sourceTaskId);
          const targetValid =
            idToTaskId.has(rec.targetTaskId) ||
            normalizedTaskIds.includes(rec.targetTaskId);
          return sourceValid && targetValid;
        })
        .map((rec: any) => ({
          sourceTaskId: idToTaskId.get(rec.sourceTaskId) || rec.sourceTaskId,
          targetTaskId: idToTaskId.get(rec.targetTaskId) || rec.targetTaskId,
          dependencyType: rec.dependencyType as "blocks" | "is_blocked_by" | "relates_to",
          confidence: Math.min(100, Math.max(0, rec.confidence)),
          reason: rec.reason || "Dependency detected",
          suggestedOrder: rec.suggestedOrder,
        }));

      // Validate circular risks
      const circularRisks = (result.circularRisks || [])
        .filter(
          (risk: any) =>
            Array.isArray(risk.taskIds) &&
            risk.taskIds.length >= 2 &&
            risk.description
        )
        .map((risk: any) => ({
          taskIds: risk.taskIds,
          description: risk.description,
          severity: ["low", "medium", "high"].includes(risk.severity)
            ? risk.severity
            : "medium",
          suggestedResolution:
            risk.suggestedResolution ||
            "Review and restructure task dependencies",
        }));

      return { recommendations, circularRisks };
    } catch (parseError) {
      console.error("Failed to parse AI response for task dependencies:", parseError);
      console.error("Raw AI response:", text);
      console.error("Cleaned text:", cleanText);
      return {
        recommendations: [],
        circularRisks: [],
        error: "Failed to parse dependency analysis results",
      };
    }
  } catch (error) {
    console.error("Error analyzing task dependencies:", error);
    return {
      recommendations: [],
      circularRisks: [],
      error: "Failed to analyze task dependencies",
    };
  }
}
