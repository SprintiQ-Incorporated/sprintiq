import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import SprintView from "@/components/workspace/views/sprint-view";
import { Metadata } from "next";
import type { Task } from "@/lib/database-aliases";
import { WORKSPACE_COLUMNS, SPACE_COLUMNS, SPRINT_FOLDER_COLUMNS, SPRINT_COLUMNS, STATUS_COLUMNS, TAG_COLUMNS } from "@/lib/query-columns";
import { getOrCreateDefaultStatuses } from "@/lib/services/statusService";

export const metadata: Metadata = {
  title: "Sprint - SprintiQ",
  description: "SprintiQ Sprint page",
};

interface SprintPageProps {
  params: Promise<{ workspaceId: string; spaceId: string; sprintFolderId: string; sprintId: string }>;
}

export default async function SprintPage({ params }: SprintPageProps) {
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
    .single();

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
    .single();

  if (!space) {
    notFound();
  }

  // Fetch the sprint folder
  // Handle inconsistency where space_id might be stored as UUID (space.id) or short ID (space.space_id)
  const { data: sprintFolder } = await supabase
    .from("sprint_folders")
    .select(SPRINT_FOLDER_COLUMNS.CORE)
    .eq("sprint_folder_id", resolvedParams.sprintFolderId)
    .eq("space_id", space.id)
    .is("deleted_at", null)
    .single();

  if (!sprintFolder) {
    notFound();
  }

  // Fetch the sprint
  const { data: sprint } = await supabase
    .from("sprints")
    .select(SPRINT_COLUMNS.CORE)
    .eq("sprint_id", resolvedParams.sprintId)
    .eq("sprint_folder_id", sprintFolder.id)
    .eq("space_id", space.id)
    .is("deleted_at", null)
    .single();

  if (!sprint) {
    notFound();
  }

  // Fetch tasks for this sprint
  const { data: tasks } = await supabase
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
    .eq("sprint_id", sprint.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<Task[]>();

  const enrichedTasks: Task[] = (tasks || []) as Task[];

  // Fetch space-level statuses for this sprint
  let { data: statuses } = await supabase
    .from("statuses")
    .select(STATUS_COLUMNS.CORE)
    .eq("workspace_id", workspace.id)
    .eq("type", "space")
    .eq("space_id", space.id)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  // Create default statuses if none exist (via centralized service)
  if (!statuses || statuses.length === 0) {
    await getOrCreateDefaultStatuses(supabase, space.id, workspace.id);

    // Re-fetch statuses after creation
    const { data: newStatuses } = await supabase
      .from("statuses")
      .select(STATUS_COLUMNS.CORE)
      .eq("workspace_id", workspace.id)
      .eq("type", "space")
      .eq("space_id", space.id)
      .is("deleted_at", null)
      .order("position", { ascending: true });

    statuses = newStatuses || [];
  }

  // Fetch tags for this workspace
  const { data: tags } = await supabase
    .from("tags")
    .select(TAG_COLUMNS.ALL)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  return (
    <SprintView
      workspace={workspace}
      space={space}
      sprintFolder={sprintFolder}
      sprint={sprint}
      tasks={enrichedTasks || []}
      statuses={statuses || []}
      tags={tags || []}
    />
  );
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
