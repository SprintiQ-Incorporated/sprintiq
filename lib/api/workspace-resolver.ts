import { SupabaseClient } from "@supabase/supabase-js";

export async function resolveWorkspaceId(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<{ uuid: string; friendlyId: string; name: string; ownerId: string } | null> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspaceId);

  const { data, error } = await supabase
    .from("workspaces")
    .select("id, workspace_id, name, owner_id")
    .eq(isUUID ? "id" : "workspace_id", workspaceId)
    .single();

  if (error || !data) return null;

  return {
    uuid: data.id,
    friendlyId: data.workspace_id,
    name: data.name,
    ownerId: data.owner_id,
  };
}
