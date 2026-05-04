import { NextRequest, NextResponse } from "next/server";
import { validateAPIKey } from "@/lib/cli/validate-api-key";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/cli/tasks/:taskId
 * Returns enriched task data for CLI prompt generation.
 * Requires Bearer CLI API key.
 * Query params: include_subtasks=true to include subtasks.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const key = await validateAPIKey(request);
    if (!key) {
      return NextResponse.json(
        { error: "Invalid or expired API key" },
        { status: 401 }
      );
    }

    const { taskId } = await params;
    const includeSubtasks =
      request.nextUrl.searchParams.get("include_subtasks") === "true";

    const supabase = createAdminClient();

    // Determine if taskId is a UUID (id column) or a short ID (task_id column)
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId);
    const filterColumn = isUUID ? "id" : "task_id";

    // Fetch task with joins
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select(
        `
        id,
        task_id,
        name,
        description,
        priority,
        story_points,
        estimated_time,
        acceptance_criteria,
        type,
        created_at,
        workspace_id,
        status_id,
        assignee_id,
        sprint_id,
        project_id,
        space_id
      `
      )
      .eq(filterColumn, taskId)
      .is("deleted_at", null)
      .maybeSingle();

    if (taskError) {
      console.error("[CLI Tasks] Query error:", taskError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    if (!task) {
      return NextResponse.json(
        { error: `Task ${taskId} not found` },
        { status: 404 }
      );
    }

    // Validate workspace ownership
    if (task.workspace_id && key.userId) {
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("owner_id")
        .eq("id", task.workspace_id)
        .maybeSingle();

      if (!workspace || workspace.owner_id !== key.userId) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }
    }

    // Fetch related data in parallel
    const [
      statusResult,
      assigneeResult,
      sprintResult,
      projectResult,
      spaceResult,
      tagsResult,
      depsResult,
    ] = await Promise.all([
      // Status
      task.status_id
        ? supabase
            .from("statuses")
            .select("name")
            .eq("id", task.status_id)
            .maybeSingle()
        : { data: null },

      // Assignee
      task.assignee_id
        ? supabase
            .from("profiles")
            .select("full_name")
            .eq("id", task.assignee_id)
            .maybeSingle()
        : { data: null },

      // Sprint
      task.sprint_id
        ? supabase
            .from("sprints")
            .select("name, start_date, end_date, status")
            .eq("id", task.sprint_id)
            .maybeSingle()
        : { data: null },

      // Project
      task.project_id
        ? supabase
            .from("projects")
            .select("name, project_id")
            .eq("id", task.project_id)
            .maybeSingle()
        : { data: null },

      // Space
      task.space_id
        ? supabase
            .from("spaces")
            .select("name")
            .eq("id", task.space_id)
            .maybeSingle()
        : { data: null },

      // Tags via task_tags join
      supabase
        .from("task_tags")
        .select("tag_id")
        .eq("task_id", task.id),

      // Dependencies (both directions)
      supabase
        .from("task_dependencies")
        .select("source_task_id, target_task_id, dependency_type")
        .or(`source_task_id.eq.${task.id},target_task_id.eq.${task.id}`),
    ]);

    // Resolve tag names
    let tags: string[] = [];
    if (tagsResult.data && tagsResult.data.length > 0) {
      const tagIds = tagsResult.data.map((tt) => tt.tag_id);
      const { data: tagRows } = await supabase
        .from("tags")
        .select("name")
        .in("id", tagIds)
        .is("deleted_at", null);
      tags = tagRows?.map((t) => t.name) ?? [];
    }

    // Resolve dependency task info
    interface DependencyOutput {
      type: "blocks" | "is_blocked_by" | "relates_to";
      task_id: string;
      name: string;
      is_completed: boolean;
    }
    const dependencies: DependencyOutput[] = [];

    if (depsResult.data && depsResult.data.length > 0) {
      // Collect all related task IDs
      const relatedTaskIds = new Set<string>();
      for (const dep of depsResult.data) {
        if (dep.source_task_id !== task.id) relatedTaskIds.add(dep.source_task_id);
        if (dep.target_task_id !== task.id) relatedTaskIds.add(dep.target_task_id);
      }

      if (relatedTaskIds.size > 0) {
        const { data: relatedTasks } = await supabase
          .from("tasks")
          .select("id, task_id, name, status_id")
          .in("id", Array.from(relatedTaskIds));

        // Fetch statuses for completion check
        const statusIds = [
          ...new Set(
            (relatedTasks ?? [])
              .map((t) => t.status_id)
              .filter(Boolean)
          ),
        ];
        const { data: depStatuses } = statusIds.length > 0
          ? await supabase.from("statuses").select("id, name").in("id", statusIds)
          : { data: [] };

        const statusMap = new Map(
          (depStatuses ?? []).map((s) => [s.id, s.name])
        );
        const taskMap = new Map(
          (relatedTasks ?? []).map((t) => [t.id, t])
        );

        for (const dep of depsResult.data) {
          const isSource = dep.source_task_id === task.id;
          const otherTaskId = isSource ? dep.target_task_id : dep.source_task_id;
          const otherTask = taskMap.get(otherTaskId);
          if (!otherTask) continue;

          let type: DependencyOutput["type"];
          if (dep.dependency_type === "relates_to") {
            type = "relates_to";
          } else if (isSource) {
            // This task is the source → it blocks the target
            type = dep.dependency_type === "blocks" ? "blocks" : "is_blocked_by";
          } else {
            // This task is the target → flip
            type = dep.dependency_type === "blocks" ? "is_blocked_by" : "blocks";
          }

          const statusName = otherTask.status_id
            ? statusMap.get(otherTask.status_id) ?? ""
            : "";
          const isCompleted =
            statusName.toLowerCase() === "done" ||
            statusName.toLowerCase() === "completed";

          dependencies.push({
            type,
            task_id: otherTask.task_id,
            name: otherTask.name,
            is_completed: isCompleted,
          });
        }
      }
    }

    // Fetch subtasks if requested
    let subtasks;
    if (includeSubtasks) {
      const { data: subtaskRows } = await supabase
        .from("tasks")
        .select("task_id, name, status_id")
        .eq("parent_task_id", task.id)
        .is("deleted_at", null);

      if (subtaskRows && subtaskRows.length > 0) {
        const subStatusIds = [
          ...new Set(subtaskRows.map((s) => s.status_id).filter(Boolean)),
        ];
        const { data: subStatuses } = subStatusIds.length > 0
          ? await supabase.from("statuses").select("id, name").in("id", subStatusIds)
          : { data: [] };

        const subStatusMap = new Map(
          (subStatuses ?? []).map((s) => [s.id, s.name])
        );

        subtasks = subtaskRows.map((s) => {
          const sName = s.status_id ? subStatusMap.get(s.status_id) ?? "Unknown" : "Unknown";
          const isCompleted =
            sName.toLowerCase() === "done" ||
            sName.toLowerCase() === "completed";
          return {
            task_id: s.task_id,
            name: s.name,
            status_name: sName,
            is_completed: isCompleted,
          };
        });
      }
    }

    // Build task_url
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const taskUrl = `${baseUrl}/w/${task.workspace_id}/task/${task.task_id}`;

    return NextResponse.json({
      task: {
        id: task.id,
        task_id: task.task_id,
        name: task.name,
        description: task.description,
        priority: task.priority,
        story_points: task.story_points,
        estimated_time: task.estimated_time,
        acceptance_criteria: task.acceptance_criteria,
        type: task.type,
        created_at: task.created_at,
        status: statusResult.data ?? { name: "Unknown" },
        assignee: assigneeResult.data ?? null,
        sprint: sprintResult.data ?? null,
        project: projectResult.data ?? null,
        space: spaceResult.data ?? null,
        tags,
        dependencies,
        ...(subtasks !== undefined ? { subtasks } : {}),
      },
      task_url: taskUrl,
    });
  } catch (error) {
    console.error("[CLI Tasks] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
