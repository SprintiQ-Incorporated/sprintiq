import { redirect, notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

interface WorkspacePageProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const supabase = await createServerSupabaseClient();
  const resolvedParams = await params;

  // Check if workspaceId is a UUID (id) or short ID (workspace_id)
  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      resolvedParams.workspaceId
    );

  let workspace;

  if (isUUID) {
    // Query by UUID (id column)
    const { data, error } = await supabase
      .from("workspaces")
      .select("workspace_id")
      .eq("id", resolvedParams.workspaceId)
      .single();

    if (error || !data) {
      notFound();
    }
    workspace = data;
  } else {
    // Query by short ID (workspace_id column)
    const { data, error } = await supabase
      .from("workspaces")
      .select("workspace_id")
      .eq("workspace_id", resolvedParams.workspaceId)
      .single();

    if (error || !data) {
      notFound();
    }
    workspace = data;
  }

  // Redirect to the main workspace route
  redirect(`/${workspace.workspace_id}/home`);
}
