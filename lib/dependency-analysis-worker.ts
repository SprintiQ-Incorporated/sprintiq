/**
 * Dependency analysis worker functions.
 *
 * Extracted from server actions (task-actions.ts, story-actions.ts) to run
 * inside the ai-fast QStash worker. Dynamically imported by the fast worker
 * route to keep cold starts lean.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { analyzeDependenciesCompletion } from "@/lib/ai-provider";
import { logAICall } from "@/lib/log-ai-call";
import type {
  DependencyRecommendation,
  CircularRiskWarning,
  UserStory,
} from "@/types";

// ── Task Dependency Analysis ──────────────────────────────────────────────────

export interface TaskDependencyPayload {
  taskIds: string[];
  workspaceId: string;
  projectId?: string;
  sprintId?: string;
  userId: string;
  taskId?: string; // ai_task_queue row id (for logAICall)
}

export interface TaskDependencyResult {
  recommendations: DependencyRecommendation[];
  circularRisks: CircularRiskWarning[];
}

export async function processDependencyAnalysis(
  payload: TaskDependencyPayload
): Promise<TaskDependencyResult> {
  const { taskIds, taskId } = payload;
  const admin = createAdminClient();
  const startMs = Date.now();

  if (taskIds.length === 0) {
    throw new Error("No tasks provided for analysis");
  }

  // Fetch tasks from the database — try by task_id first, fall back to UUID
  let { data: tasks, error: fetchError } = await admin
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

  if ((!tasks || tasks.length === 0) && !fetchError) {
    const { data: tasksByUuid, error: uuidFetchError } = await admin
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
    throw new Error(`Failed to fetch tasks: ${fetchError.message}`);
  }

  if (!tasks || tasks.length === 0) {
    throw new Error("No tasks found with the provided IDs");
  }

  // Build id→task_id map for consistent output
  const idToTaskId = new Map<string, string>();
  tasks.forEach((task) => {
    idToTaskId.set(task.id, task.task_id);
    idToTaskId.set(task.task_id, task.task_id);
  });
  const normalizedTaskIds = tasks.map((t) => t.task_id);

  // Fetch existing dependencies for context
  const { data: existingDeps } = await admin
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

  const aiResult = await analyzeDependenciesCompletion(prompt, tasks.length);
  const text = aiResult.text;
  const durationMs = Date.now() - startMs;

  // Log AI call
  logAICall({
    taskId,
    provider: aiResult.provider,
    model: aiResult.model,
    queue: "fast",
    taskType: "dependency_analysis",
    success: true,
    inputTokens: aiResult.usage?.inputTokens ?? 0,
    outputTokens: aiResult.usage?.outputTokens ?? 0,
    costUsd: 0,
    durationMs,
  });

  // Parse response
  const cleanText = text
    .replace(/```json\n?|\n?```/g, "")
    .replace(/^[^{]*/, "")
    .replace(/[^}]*$/, "")
    .trim();

  const result = JSON.parse(cleanText);

  // Validate and filter recommendations
  const recommendations: DependencyRecommendation[] = (result.recommendations || [])
    .filter((rec: any) => {
      if (
        !rec.sourceTaskId ||
        !rec.targetTaskId ||
        !rec.dependencyType ||
        rec.confidence < 70
      ) {
        return false;
      }
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
  const circularRisks: CircularRiskWarning[] = (result.circularRisks || [])
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
}

// ── Story Dependency Analysis ─────────────────────────────────────────────────

export interface StoryDependencyPayload {
  stories: UserStory[];
  userId: string;
  taskId?: string; // ai_task_queue row id (for logAICall)
}

export interface StoryDependencyResult {
  suggestions: {
    storyId: string;
    suggestedDependencies: {
      taskId: string;
      reason: string;
      confidence: number;
    }[];
  }[];
}

export async function processStoryDependencyAnalysis(
  payload: StoryDependencyPayload
): Promise<StoryDependencyResult> {
  const { stories, taskId } = payload;
  const startMs = Date.now();

  const prompt = `
      Analyze these user stories and suggest logical dependencies between them.
      Consider:
      1. Prerequisites (e.g., authentication before accessing features)
      2. Sequential dependencies (e.g., setup before configuration)
      3. Common patterns (e.g., data model before CRUD operations)
      4. Technical dependencies (e.g., API endpoints before UI implementation)

      For each story, suggest other stories that should be completed first.
      Provide a confidence score (0-1) and a clear reason for each suggestion.

      Stories to analyze:
      ${stories
        .map(
          (story) => `
        ID: ${story.id}
        Title: ${story.title}
        Role: ${story.role}
        Want: ${story.want}
        Benefit: ${story.benefit}
        Acceptance Criteria:
        ${story.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}
      `
        )
        .join("\n")}

      Return ONLY a valid JSON array with this exact structure, without any markdown formatting or additional text:
      [
        {
          "storyId": "story_id",
          "suggestedDependencies": [
            {
              "taskId": "dependent_story_id",
              "reason": "Clear explanation of why this dependency exists",
              "confidence": 0.95
            }
          ]
        }
      ]
    `;

  const aiResult = await analyzeDependenciesCompletion(prompt, stories.length);
  const text = aiResult.text;
  const durationMs = Date.now() - startMs;

  // Log AI call
  logAICall({
    taskId,
    provider: aiResult.provider,
    model: aiResult.model,
    queue: "fast",
    taskType: "story_dependency_analysis",
    success: true,
    inputTokens: aiResult.usage?.inputTokens ?? 0,
    outputTokens: aiResult.usage?.outputTokens ?? 0,
    costUsd: 0,
    durationMs,
  });

  // Parse response
  const cleanText = text
    .replace(/```json\n?|\n?```/g, "")
    .replace(/^[^\[]*/, "")
    .replace(/[^\]]*$/, "")
    .trim();

  const suggestions = JSON.parse(cleanText);

  if (!Array.isArray(suggestions)) {
    throw new Error("Invalid suggestions format received from AI");
  }

  return { suggestions };
}
