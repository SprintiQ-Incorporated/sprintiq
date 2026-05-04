import type React from "react";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import WorkspaceSidebar from "@/components/workspace/layout/sidebar";
import WorkspaceHeader from "@/components/workspace/layout/header";
import MobileNav from "@/components/workspace/layout/mobile-nav";
import type {
  SpaceBase,
  ProjectBase,
  SprintFolderBase,
  SprintBase,
} from "@/types/display-types";
import { WORKSPACE_COLUMNS, PROFILE_COLUMNS } from "@/lib/query-columns";

/** Type for spaces query result with nested relations */
type SpaceWithLayoutRelations = SpaceBase & {
  projects: ProjectBase[];
  sprint_folders: (SprintFolderBase & { sprints: SprintBase[] })[];
};

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const supabase = await createServerSupabaseClient();
  const resolvedParams = await params;

  const { user } = await getAuthUser(supabase);

  if (!user) {
    redirect("/signin");
  }

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select(WORKSPACE_COLUMNS.CORE)
    .eq("workspace_id", resolvedParams.workspaceId)
    .single();

  if (error || !workspace) {
    notFound();
  }

  const userId = user.id;
  const workspaceUuid = workspace.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS.WITH_PREFERENCES)
    .eq("id", userId)
    .single();

  const { data: spacesData } = await supabase
    .from("spaces")
    .select(
      `
    *,
    projects (*),
    sprint_folders (
      *,
      sprints (*)
    )
  `
    )
    .eq("workspace_id", workspaceUuid)
    .order("created_at", { ascending: true })
    .returns<SpaceWithLayoutRelations[]>();

  const spaces = spacesData || [];

  return (
    <div className="h-screen flex workspace-bg p-2 gap-2">
      <WorkspaceSidebar
        workspace={workspace}
        profile={profile}
        spaces={spaces}
      />
      <div className="flex-1 flex flex-col overflow-hidden gap-2">
        <div className="flex items-center gap-2">
          <div className="md:hidden">
            <MobileNav
              workspace={workspace}
              profile={profile}
              spaces={spaces}
            />
          </div>
          <div className="flex-1">
            <WorkspaceHeader workspace={workspace} user={user} />
          </div>
        </div>
        <div className="flex-1 flex overflow-hidden rounded-xl">
          <main className="flex-1 overflow-auto workspace-header-bg">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}