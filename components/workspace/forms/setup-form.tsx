"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, Rocket } from "lucide-react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getOrCreateDefaultStatuses } from "@/lib/services/statusService";
import { BrandLockup } from "@/components/branding/BrandLockup";

export default function SetupWorkspaceForm() {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingWorkspace, setIsCheckingWorkspace] = useState(true);

  const router = useRouter();
  const supabase = createClientSupabaseClient();

  // Client-side guard: redirect to existing workspace on mount.
  // The server-side guard in page.tsx handles full navigations, but the browser
  // can serve the cached page on back-button without hitting the server.
  useEffect(() => {
    const checkExistingWorkspace = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setIsCheckingWorkspace(false);
        return;
      }

      const { data: existing } = await supabase
        .from("workspaces")
        .select("workspace_id")
        .eq("owner_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (existing) {
        router.replace(`/${existing.workspace_id}/home`);
      } else {
        setIsCheckingWorkspace(false);
      }
    };

    checkExistingWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        setError("Your session has expired. Please sign in again.");
        return;
      }

      const trimmed = name.trim();
      if (!trimmed) {
        setError("Workspace name is required.");
        return;
      }

      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .insert({
          name: trimmed,
          purpose: "Work",
          type: "Web",
          category: "Software Development",
          owner_id: user.id,
        })
        .select("id, workspace_id")
        .single();

      if (workspaceError || !workspace) {
        throw new Error(workspaceError?.message || "Failed to create workspace");
      }

      const { data: space, error: spaceError } = await supabase
        .from("spaces")
        .insert({
          name: "General",
          workspace_id: workspace.id,
        })
        .select("id")
        .single();

      if (spaceError || !space) {
        throw new Error(spaceError?.message || "Failed to create default space");
      }

      const { error: projectError } = await supabase
        .from("projects")
        .insert({
          name: "Getting Started",
          space_id: space.id,
          workspace_id: workspace.id,
        });

      if (projectError) {
        console.error("Failed to create Getting Started project:", projectError);
      }

      try {
        await getOrCreateDefaultStatuses(supabase, space.id, workspace.id);
      } catch (statusError) {
        console.error("Failed to create default statuses:", statusError);
      }

      router.push(`/${workspace.workspace_id}/home`);
    } catch (err: any) {
      console.error("[Workspace Creation] Error:", err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingWorkspace) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
      </div>

      <Card className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-xl border border-emerald-500/20 rounded-3xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <BrandLockup size="lg" variant="light" />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            Welcome to SprintiQ Turbo
          </h1>
          <p className="text-slate-300">Name your workspace to get started.</p>
        </div>

        {error && (
          <Alert
            variant="destructive"
            className="mb-6 bg-red-500/10 border-red-500/20"
          >
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-300 text-sm">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={createWorkspace} className="space-y-6">
          <div>
            <Label
              htmlFor="workspace-name"
              className="text-white font-semibold mb-2 block"
            >
              Workspace name
            </Label>
            <Input
              id="workspace-name"
              autoFocus
              required
              maxLength={100}
              placeholder="e.g. My Projects"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 bg-slate-800/50 border-2 border-slate-600/50 text-white placeholder:text-slate-400 rounded-xl focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
            />
            <p className="text-xs text-slate-400 mt-2">
              You can rename this later.
            </p>
          </div>

          <Button
            type="submit"
            disabled={isLoading || !name.trim()}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-lg disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                <Rocket className="h-5 w-5 mr-2" />
                Create workspace
              </>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
