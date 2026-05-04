"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, Building2 } from "lucide-react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface WorkspaceOption {
  id: string;
  workspace_id: string;
  name: string;
}

interface WorkspaceSwitcherProps {
  currentWorkspaceShortId: string;
  currentWorkspaceName: string;
}

/**
 * Inline workspace switcher for the header.
 * Lists every workspace the user is a member of (owner + invited).
 * Hidden when the user only has access to one workspace.
 */
export function WorkspaceSwitcher({
  currentWorkspaceShortId,
  currentWorkspaceName,
}: WorkspaceSwitcherProps) {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClientSupabaseClient();

  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, workspace_id, name, deleted_at")
        .eq("owner_id", user.id)
        .is("deleted_at", null);

      if (cancelled) return;
      if (error) {
        setWorkspaces([]);
        setLoading(false);
        return;
      }

      const list: WorkspaceOption[] = (data ?? [])
        .map((w: any) => ({ id: w.id, workspace_id: w.workspace_id, name: w.name }));

      // Sort: current first, then alphabetical
      list.sort((a, b) => {
        if (a.workspace_id === currentWorkspaceShortId) return -1;
        if (b.workspace_id === currentWorkspaceShortId) return 1;
        return a.name.localeCompare(b.name);
      });

      setWorkspaces(list);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, supabase, currentWorkspaceShortId]);

  // Hide when there's nothing to switch to
  if (loading || workspaces.length < 2) {
    return null;
  }

  const handleSwitch = (shortId: string) => {
    if (shortId === currentWorkspaceShortId) return;
    router.push(`/${shortId}/home`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 max-w-[180px] sm:max-w-[240px] px-2"
          title="Switch workspace"
        >
          <Building2 className="h-4 w-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
          <span className="truncate font-medium text-sm">
            {currentWorkspaceName}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Your workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((ws) => {
          const isCurrent = ws.workspace_id === currentWorkspaceShortId;
          return (
            <DropdownMenuItem
              key={ws.id}
              onClick={() => handleSwitch(ws.workspace_id)}
              className={cn(
                "cursor-pointer flex items-center gap-2 text-sm",
                isCurrent && "font-semibold"
              )}
            >
              <Building2 className="h-4 w-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
              <span className="truncate flex-1">{ws.name}</span>
              {isCurrent && (
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
