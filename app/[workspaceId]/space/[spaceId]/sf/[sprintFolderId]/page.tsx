import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import SprintFolderView from "@/components/workspace/views/sprint-folder-view";
import { Metadata } from "next";
import type { Task, Status, Space, Workspace, SprintFolder, Sprint, Project } from "@/lib/database-aliases";
import { WORKSPACE_COLUMNS, SPACE_COLUMNS, SPRINT_FOLDER_COLUMNS, SPRINT_COLUMNS, PROJECT_COLUMNS, TASK_COLUMNS, STATUS_COLUMNS } from "@/lib/query-columns";

export const metadata: Metadata = {
  title: "Sprint Folder - SprintiQ",
  description: "SprintiQ Sprint folder page",
};

interface SprintFolderPageProps {
  params: Promise<{ workspaceId: string; spaceId: string; sprintFolderId: string }>;
}

export default async function SprintFolderPage({
  params,
}: SprintFolderPageProps) {
  const supabase = await createServerSupabaseClient();
  const resolvedParams = await params;

  // Get the current user
  const { user, error: userError } = await getAuthUser(supabase);

  if (userError || !user) {
    redirect("/auth/signin");
  }

  // Fetch the workspace
  const { data: workspace } = await supabase
    .from("workspaces")
    .select(WORKSPACE_COLUMNS.CORE)
    .eq("workspace_id", resolvedParams.workspaceId)
    .is("deleted_at", null)
    .single()
    .returns<Workspace>();

  if (!workspace) {
    notFound();
  }

  if ((workspace as { owner_id?: string }).owner_id !== user.id) {
    redirect("/auth/signin");
  }

  // Fetch the space
  const { data: space } = await supabase
    .from("spaces")
    .select(SPACE_COLUMNS.CORE)
    .eq("space_id", resolvedParams.spaceId)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .single()
    .returns<Space>();

  if (!space) {
    notFound();
  }

  // Fetch the sprint folder with sprints
  // Handle inconsistency where space_id might be stored as UUID (space.id) or short ID (space.space_id)
  const { data: sprintFolder } = await supabase
    .from("sprint_folders")
    .select(
      `
      ${SPRINT_FOLDER_COLUMNS.CORE},
      days!sprint_folders_sprint_start_day_id_fkey (id, name),
      sprints (${SPRINT_COLUMNS.CORE})
    `
    )
    .eq("sprint_folder_id", resolvedParams.sprintFolderId)
    .eq("space_id", space.id)
    .is("deleted_at", null)
    .single()
    .returns<SprintFolder & { sprints: Sprint[] }>();

  if (!sprintFolder) {
    notFound();
  }

  // Fetch the associated project if sprint folder has project_id
  let project: Project | null = null;
  if (sprintFolder.project_id) {
    
    // Try fetching by UUID first (if project_id is a UUID)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sprintFolder.project_id)) {
      const { data: projectData } = await supabase
        .from("projects")
        .select(PROJECT_COLUMNS.CORE)
        .eq("id", sprintFolder.project_id)
        .is("deleted_at", null)
        .single();

      project = projectData as Project | null;
    } else {
      // Otherwise assume it's a short ID and query by project_id column
      const { data: projectData } = await supabase
        .from("projects")
        .select(PROJECT_COLUMNS.CORE)
        .eq("project_id", sprintFolder.project_id)
        .is("deleted_at", null)
        .single();

      project = projectData as Project | null;
    }
  } else {
  }

  // Batch fetch all tasks for all sprints at once (avoids N+1 per sprint)
  const activeSprints = sprintFolder.sprints.filter(
    (sprint: any) => !sprint.deleted_at
  );
  const sprintIds = activeSprints.map((s: any) => s.id);

  let allTasks: Task[] = [];
  if (sprintIds.length > 0) {
    const { data: tasksData } = await supabase
      .from("tasks")
      .select(
        `
        ${TASK_COLUMNS.CORE},
        status:statuses (${STATUS_COLUMNS.CORE}),
        assignee:profiles!tasks_assignee_id_fkey (
          id,
          full_name,
          avatar_url,
          email
        )
      `
      )
      .in("sprint_id", sprintIds)
      .is("deleted_at", null)
      .returns<Task[]>();
    allTasks = tasksData || [];
  }

  // Group tasks by sprint_id in memory
  const tasksBySprintId = new Map<string, any[]>();
  allTasks.forEach((task: any) => {
    const list = tasksBySprintId.get(task.sprint_id) || [];
    list.push(task);
    tasksBySprintId.set(task.sprint_id, list);
  });

  const sprintsWithTasks = activeSprints.map((sprint: any) => ({
    ...sprint,
    tasks: tasksBySprintId.get(sprint.id) || [],
  }));

  const sprintFolderWithTasks = {
    ...sprintFolder,
    sprints: sprintsWithTasks,
  };

  // Fetch all statuses for the workspace to calculate progress
  const { data: statuses } = await supabase
    .from("statuses")
    .select(
      `
      ${STATUS_COLUMNS.CORE},
      status_type:status_types (id, name)
    `
    )
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("position", { ascending: true })
    .returns<Status[]>();

  // Fetch all status types for reference
  const { data: statusTypes } = await supabase
    .from("status_types")
    .select("*")
    .order("name", { ascending: true });

  // Fetch all spaces for the workspace (needed for sidebar)
  const { data: spaces } = await supabase
    .from("spaces")
    .select(
      `
      ${SPACE_COLUMNS.CORE},
      projects (${PROJECT_COLUMNS.CORE}),
      sprint_folders (
        ${SPRINT_FOLDER_COLUMNS.CORE},
        sprints (${SPRINT_COLUMNS.CORE})
      )
    `
    )
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .returns<(Space & { projects: any[]; sprint_folders: any[] })[]>();

  if (!spaces) {
    notFound();
  }

  // Filter out soft-deleted projects, sprint folders, and sprints from spaces data
  const filteredSpaces = spaces.map((space: any) => ({
    ...space,
    projects: (space.projects || []).filter(
      (project: any) => !project.deleted_at
    ),
    sprint_folders: (space.sprint_folders || [])
      .map((sf: any) => ({
        ...sf,
        sprints: (sf.sprints || []).filter((sprint: any) => !sprint.deleted_at),
      }))
      .filter((sf: any) => !sf.deleted_at),
  }));

  return (
    <SprintFolderView
      workspace={workspace}
      space={space}
      sprintFolder={sprintFolderWithTasks}
      project={project}
      spaces={filteredSpaces}
      statuses={statuses || []}
      statusTypes={statusTypes || []}
    />
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
