import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import ProjectView from "@/components/workspace/views/project-view";
import type { Task, Status } from "@/lib/database-aliases";
import { Metadata } from "next";
import { WORKSPACE_COLUMNS, SPACE_COLUMNS, PROJECT_COLUMNS, STATUS_COLUMNS, TAG_COLUMNS, TASK_COLUMNS } from "@/lib/query-columns";
import { getOrCreateDefaultStatuses } from "@/lib/services/statusService";

export const metadata: Metadata = {
  title: "Project - SprintiQ",
  description: "SprintiQ Project page",
};

interface ProjectPageProps {
  params: Promise<{ workspaceId: string; spaceId: string; projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const supabase = await createServerSupabaseClient();
  const resolvedParams = await params;

  // Get current user
  const { user, error: userError } = await getAuthUser(supabase);

  if (userError || !user) {
    redirect("/auth/signin");
  }

  // Get workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select(WORKSPACE_COLUMNS.CORE)
    .eq("workspace_id", resolvedParams.workspaceId)
    .single();

  if (workspaceError || !workspace) {
    notFound();
  }

  if ((workspace as { owner_id?: string }).owner_id !== user.id) {
    redirect("/auth/signin");
  }

  // Get space
  const { data: space, error: spaceError } = await supabase
    .from("spaces")
    .select(SPACE_COLUMNS.CORE)
    .eq("space_id", resolvedParams.spaceId)
    .eq("workspace_id", workspace.id)
    .single();

  // After space lookup

  if (spaceError || !space) {
    notFound();
  }

  // Get project with fresh data
  
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS.CORE)
    .eq("project_id", resolvedParams.projectId)
    .eq("space_id", space.id)
    .single();

  // After project lookup

  if (projectError || !project) {
    console.error("[Project Page] Project not found!", {
      projectId: resolvedParams.projectId,
      spaceId: space.id,
      error: projectError
    });
    notFound();
  }

  // Get space-level statuses for this project:
  let { data: statuses } = await supabase
    .from("statuses")
    .select(
      `
      ${STATUS_COLUMNS.CORE},
      status_type:status_types!statuses_status_type_id_fkey(id, name)
    `
    )
    .eq("workspace_id", workspace.id)
    .eq("type", "space")
    .eq("space_id", space.id)
    .is("deleted_at", null)
    .order("position", { ascending: true })
    .returns<Status[]>();

  // Create default statuses if none exist (via centralized service)
  if (!statuses || statuses.length === 0) {
    await getOrCreateDefaultStatuses(supabase, space.id, workspace.id);

    // Re-fetch statuses with the full join needed by ProjectView
    const { data: newStatuses } = await supabase
      .from("statuses")
      .select(
        `
        ${STATUS_COLUMNS.CORE},
        status_type:status_types!statuses_status_type_id_fkey(id, name)
      `
      )
      .eq("workspace_id", workspace.id)
      .eq("type", "space")
      .eq("space_id", space.id)
      .is("deleted_at", null)
      .order("position", { ascending: true })
      .returns<Status[]>();

    statuses = newStatuses || [];
  }

  // Get tasks for this project with proper joins.
  // Uses OR filter to match client-side refresh query (useProjectData.ts) — fetches tasks
  // belonging to this project OR tasks in sprints from this space (handles edge cases where
  // tasks may have space_id set but not project_id)

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select(
      `
      ${TASK_COLUMNS.CORE},
      assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url),
      created_by_profile:profiles!tasks_created_by_fkey(id, full_name, avatar_url),
      status:statuses(${STATUS_COLUMNS.CORE}),
      task_tags(tag:tags(${TAG_COLUMNS.ALL}))
    `
    )
    .or(`project_id.eq.${project.id},space_id.eq.${space.id}`)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<Task[]>();

  // Log task query results for debugging sprint display issues
  if (tasksError) {
    console.error('[Project Page] Tasks query failed:', {
      error: tasksError,
      projectId: project.id,
      spaceId: space.id,
      projectSlug: resolvedParams.projectId,
    });
    // Don't call notFound() - show project with error message instead
  } else if (tasks) {
    const sprintTasks = tasks.filter((t: any) => t.sprint_id);
    if (sprintTasks.length === 0 && tasks.length > 0) {
      console.warn('[Project Page] No tasks have sprint_id set. Tasks may not appear in sprint views.', {
        totalTasks: tasks.length,
        projectId: project.id,
      });
    }
  }

  const tasksData: Task[] = (tasks || []) as Task[];

  // Get tags for this workspace
  const { data: tags, error: tagsError } = await supabase
    .from("tags")
    .select(TAG_COLUMNS.ALL)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  // Only fail on actual errors, not empty arrays (new workspaces can have 0 tags)
  if (tagsError) {
    console.error('[Project Page] Tags query failed:', tagsError);
  }

  const tagsData = tags || [];

  return (
    <ProjectView
      key={`${resolvedParams.workspaceId}-${resolvedParams.spaceId}-${resolvedParams.projectId}`}
      workspace={workspace}
      space={space}
      project={project}
      tasks={tasksData}
      statuses={statuses || []}
      tags={tagsData}
    />
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
