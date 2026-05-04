import { redirect } from "next/navigation";
import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import SetupWorkspaceForm from "@/components/workspace/forms/setup-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup Workspace - SprintiQ",
  description: "SprintiQ Setup Workspace page",
};

export default async function SetupWorkspacePage() {
  const supabase = await createServerSupabaseClient();

  const { user } = await getAuthUser(supabase);

  if (user) {
    // Check if user already owns a workspace
    const { data: ownedWorkspaces } = await supabase
      .from("workspaces")
      .select("workspace_id")
      .eq("owner_id", user.id)
      .is("deleted_at", null)
      .limit(1);

    if (ownedWorkspaces && ownedWorkspaces.length > 0) {
      redirect(`/${ownedWorkspaces[0].workspace_id}/home`);
    }

  }

  return (
    <div className="min-h-screen py-4 sm:py-6 lg:py-8 px-2 sm:px-4 lg:px-0">
      <SetupWorkspaceForm />
    </div>
  );
}
