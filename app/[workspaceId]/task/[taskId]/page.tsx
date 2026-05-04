import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import TaskDetailView from "@/components/workspace/views/task-detail-view/index";
import { Metadata } from "next";
import type { Task } from "@/lib/database-aliases";
import { WORKSPACE_COLUMNS, SPACE_COLUMNS, SPRINT_COLUMNS, PROJECT_COLUMNS, STATUS_COLUMNS, TAG_COLUMNS, TASK_COLUMNS, TASK_AI_METADATA_COLUMNS, PROFILE_COLUMNS } from "@/lib/query-columns";

export const metadata: Metadata = {
  title: "Task - SprintiQ",
  description: "SprintiQTask detail page",
};

interface TaskPageProps {
  params: Promise<{ workspaceId: string; taskId: string }>;
}

export default async function TaskPage({ params }: TaskPageProps) {
  const supabase = await createServerSupabaseClient();
  const resolvedParams = await params;

  // Validate params
  if (!resolvedParams.taskId || !resolvedParams.workspaceId) {
    console.error("Invalid params:", resolvedParams);
    notFound();
  }

  try {
    // Define the select query for reuse
    const taskSelectQuery = `
      ${TASK_COLUMNS.CORE},
      assignee:profiles!tasks_assignee_id_fkey(${PROFILE_COLUMNS.DISPLAY}),
      status:statuses(${STATUS_COLUMNS.CORE}),
      task_tags(
        tag:tags(${TAG_COLUMNS.ALL})
      ),
      task_ai_metadata(${TASK_AI_METADATA_COLUMNS.GENERATION})
    `;


    // Try to get the task by task_id first
    let { data: task, error: taskError } = await supabase
      .from("tasks")
      .select(taskSelectQuery)
      .eq("task_id", resolvedParams.taskId)
      .is("deleted_at", null)
      .single() as { data: Task | null; error: any };

    // If not found by task_id, try by UUID id (for backwards compatibility with older tasks)
    if (!task) {
      const uuidResult = await supabase
        .from("tasks")
        .select(taskSelectQuery)
        .eq("id", resolvedParams.taskId)
        .is("deleted_at", null)
        .single() as { data: Task | null; error: any };

      if (uuidResult.data) {
        task = uuidResult.data;
        taskError = null;
      }
    }

    if (!task) {
      console.error(
        "Task not found in database for task_id or id:",
        resolvedParams.taskId
      );
      notFound();
    }

    // Get workspace by workspace_id
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select(WORKSPACE_COLUMNS.CORE)
      .eq("workspace_id", resolvedParams.workspaceId)
      .single();

    if (workspaceError || !workspace) {
      console.error("Workspace not found:", workspaceError);
      notFound();
    }

    // Verify task belongs to this workspace

    if (task.workspace_id !== workspace.id) {
      console.error(
        "Task does not belong to this workspace:",
        task.workspace_id,
        "vs",
        workspace.id
      );
      notFound();
    }

    // Get space
    if (!task.space_id) {
      console.error("Task has no space_id");
      notFound();
    }

    const { data: space, error: spaceError } = await supabase
      .from("spaces")
      .select(SPACE_COLUMNS.CORE)
      .eq("id", task.space_id)
      .single();

    if (spaceError || !space) {
      console.error("Space not found:", spaceError);
      notFound();
    }

    // Get project (optional - task might belong to a sprint instead)
    let project = null;
    if (task.project_id) {
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select(PROJECT_COLUMNS.CORE)
        .eq("id", task.project_id)
        .single();

      if (!projectError && projectData) {
        project = projectData;
      }
    }

    // Get sprint if task belongs to one
    let sprint = null;
    if (task.sprint_id) {
      const { data: sprintData, error: sprintError } = await supabase
        .from("sprints")
        .select(SPRINT_COLUMNS.CORE)
        .eq("id", task.sprint_id)
        .single();

      if (!sprintError && sprintData) {
        sprint = sprintData;
      }
    }

    // Get statuses for this workspace, including sprint-specific statuses if applicable
    let statusesQuery = supabase
      .from("statuses")
      .select(STATUS_COLUMNS.CORE)
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null);

    if (sprint) {
      // If task belongs to a sprint, include both space and sprint statuses
      statusesQuery = statusesQuery.or(
        `and(type.eq.space,space_id.eq.${space.id}),and(type.eq.sprint,sprint_id.eq.${sprint.id})`
      );
    } else if (project) {
      // If task belongs to a project, include both space and project statuses
      statusesQuery = statusesQuery.or(
        `and(type.eq.space,space_id.eq.${space.id}),and(type.eq.project,project_id.eq.${project.id})`
      );
    } else {
      // If task doesn't belong to a project or sprint, only include space statuses
      statusesQuery = statusesQuery
        .eq("type", "space")
        .eq("space_id", space.id);
    }

    const { data: statuses, error: statusesError } = await statusesQuery.order(
      "position",
      { ascending: true }
    );

    if (statusesError) {
      console.error("Error fetching statuses:", statusesError);
      notFound();
    }

    // Get tags for this workspace
    const { data: tags, error: tagsError } = await supabase
      .from("tags")
      .select(TAG_COLUMNS.ALL)
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (tagsError) {
      console.error("Error fetching tags:", tagsError);
      notFound();
    }

    return (
      <TaskDetailView
        task={task as any}
        workspace={workspace as any}
        space={space as any}
        project={project as any}
        sprint={sprint as any}
        statuses={statuses || []}
        tags={tags || []}
      />
    );
  } catch (error) {
    console.error("Error loading task page:", error);
    notFound();
  }
}
