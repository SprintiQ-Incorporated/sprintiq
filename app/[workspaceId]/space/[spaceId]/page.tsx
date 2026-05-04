import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Metadata } from "next";
import { SpaceContent } from "@/components/portfolio/space-content";
import { WORKSPACE_COLUMNS, SPACE_COLUMNS, PROJECT_COLUMNS } from "@/lib/query-columns";

export const metadata: Metadata = {
  title: "Portfolio - SprintiQ",
  description: "SprintiQ Portfolio page",
};

interface SpacePageProps {
  params: Promise<{ workspaceId: string; spaceId: string }>;
}

export default async function SpacePage({ params }: SpacePageProps) {
  const supabase = await createServerSupabaseClient();
  const resolvedParams = await params;

  // Get the current user
  const { user, error: userError } = await getAuthUser(supabase);

  if (userError || !user) {
    redirect("/signin");
  }

  // Fetch the workspace using short workspace_id
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
    redirect("/signin");
  }

  // Fetch the space using space_id
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

  // Fetch projects in this space
  const { data: projects } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS.CORE)
    .eq("space_id", space.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Fetch sprint folders in this space
  const { data: sprintFolders } = await supabase
    .from("sprint_folders")
    .select("id, sprint_folder_id, name, project_id")
    .eq("space_id", space.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Fetch sprints count per folder
  const { data: sprints } = await supabase
    .from("sprints")
    .select("id, sprint_folder_id")
    .in("sprint_folder_id", (sprintFolders || []).map(f => f.id))
    .is("deleted_at", null);

  // Map sprint counts to folders
  const sprintFoldersWithCounts = (sprintFolders || []).map(folder => ({
    ...folder,
    sprints: (sprints || []).filter(s => s.sprint_folder_id === folder.id),
  }));

  return (
    <SpaceContent
      workspace={workspace}
      space={space}
      projects={projects || []}
      sprintFolders={sprintFoldersWithCounts}
      workspaceId={resolvedParams.workspaceId}
      spaceId={resolvedParams.spaceId}
    />
  );
}
