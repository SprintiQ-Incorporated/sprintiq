"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { Loader2 } from "lucide-react";

export default function WorkspacePage() {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientSupabaseClient();

  useEffect(() => {
    const redirectToWorkspace = async () => {
      if (!user) return;

      try {
        const { data: workspace } = await supabase
          .from("workspaces")
          .select("workspace_id") // Use short ID for redirect
          .eq("owner_id", user.id)
          .limit(1)
          .single();

        if (workspace) {
          router.push(`/${workspace.workspace_id}/home`); // Use short ID
        } else {
          router.push("/setup-workspace");
        }
      } catch {
        router.push("/setup-workspace");
      }
    };

    redirectToWorkspace();
  }, [user, router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
    </div>
  );
}
