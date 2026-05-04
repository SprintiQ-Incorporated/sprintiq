import { redirect } from "next/navigation";
import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createServerSupabaseClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    redirect("/signin");
  }

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("workspace_id")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .limit(1);

  if (workspaces && workspaces.length > 0) {
    redirect(`/${workspaces[0].workspace_id}/home`);
  }

  redirect("/setup-workspace");
}
