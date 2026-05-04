/**
 * Sidebar Data Hook
 * Manages data fetching and real-time subscriptions for sidebar entities.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { STATUS_COLUMNS } from "@/lib/query-columns";
import type { Status } from "@/lib/database-aliases";
import type { SpaceWithSidebarRelations } from "../types";

export interface UseSidebarDataProps {
  workspaceId: string;
  initialSpaces: SpaceWithSidebarRelations[];
}

export interface UseSidebarDataReturn {
  spaces: SpaceWithSidebarRelations[];
  setSpaces: React.Dispatch<React.SetStateAction<SpaceWithSidebarRelations[]>>;
  statuses: Status[];
  taskCounts: Record<string, number>;
  isLoading: boolean;
  refreshSpaces: () => Promise<void>;
  refreshStatuses: () => Promise<void>;
  refreshTaskCounts: () => Promise<void>;
  debouncedRefreshTaskCounts: () => void;
}

/** Filter soft-deleted items from spaces data */
function filterDeleted(spaces: SpaceWithSidebarRelations[]): SpaceWithSidebarRelations[] {
  return spaces.filter((s) => !s.deleted_at).map((space) => ({
    ...space,
    projects: (space.projects || []).filter((p) => !p.deleted_at),
    sprint_folders: (space.sprint_folders || []).filter((sf) => !sf.deleted_at).map((sf) => ({
      ...sf,
      sprints: (sf.sprints || []).filter((s) => !s.deleted_at),
    })),
  }));
}

/** Extract project IDs from spaces */
function getProjectIds(spaces: SpaceWithSidebarRelations[]): string[] {
  return spaces.flatMap((s) => (s.projects || []).filter((p) => !p.deleted_at).map((p) => p.id));
}

/** Extract sprint IDs from spaces */
function getSprintIds(spaces: SpaceWithSidebarRelations[]): string[] {
  return spaces.flatMap((s) =>
    (s.sprint_folders || []).filter((sf) => !sf.deleted_at)
      .flatMap((sf) => (sf.sprints || []).filter((sp) => !sp.deleted_at).map((sp) => sp.id))
  );
}

export function useSidebarData({ workspaceId, initialSpaces }: UseSidebarDataProps): UseSidebarDataReturn {
  const supabase = createClientSupabaseClient();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [spaces, setSpaces] = useState<SpaceWithSidebarRelations[]>(() => filterDeleted(initialSpaces));
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  const refreshStatuses = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("statuses")
        .select(STATUS_COLUMNS.CORE).eq("workspace_id", workspaceId)
        .is("deleted_at", null).order("position", { ascending: true });
      if (error) { console.error("Error fetching statuses:", error); return; }
      if (data) setStatuses(data);
    } catch (err) { console.error("Error fetching statuses:", err); }
  }, [supabase, workspaceId]);

  const refreshTaskCounts = useCallback(async () => {
    try {
      const projectIds = getProjectIds(spaces);
      const sprintIds = getSprintIds(spaces);
      if (projectIds.length === 0 && sprintIds.length === 0) { setTaskCounts({}); return; }

      const parts: string[] = [];
      if (projectIds.length > 0) parts.push(`project_id.in.(${projectIds.join(",")})`);
      if (sprintIds.length > 0) parts.push(`sprint_id.in.(${sprintIds.join(",")})`);
      const filter = parts.length > 1 ? `or(${parts.join(",")})` : parts[0];

      const { data, error } = await supabase.from("tasks")
        .select("project_id, sprint_id").is("deleted_at", null).or(filter);
      if (error) { console.error("Error fetching task counts:", error); return; }

      if (data) {
        const counts = data.reduce((acc, t) => {
          if (t.project_id) acc[t.project_id] = (acc[t.project_id] || 0) + 1;
          if (t.sprint_id) acc[t.sprint_id] = (acc[t.sprint_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        setTaskCounts(counts);
      }
    } catch (err) { console.error("Error fetching task counts:", err); }
  }, [supabase, spaces]);

  const debouncedRefreshTaskCounts = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => refreshTaskCounts(), 300);
  }, [refreshTaskCounts]);

  const refreshSpaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("spaces")
        .select(`*, projects (*), sprint_folders (*, sprints (*))`)
        .eq("workspace_id", workspaceId).is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) { console.error("Error fetching spaces:", error); return; }
      if (data) setSpaces(filterDeleted(data as unknown as SpaceWithSidebarRelations[]));
    } catch (err) { console.error("Error refreshing spaces:", err); }
    finally { setIsLoading(false); }
  }, [supabase, workspaceId]);

  // Initial fetch
  useEffect(() => { refreshStatuses(); refreshTaskCounts(); }, [refreshStatuses, refreshTaskCounts]);

  // Cleanup debounce
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // Entity subscriptions
  useEffect(() => {
    if (!workspaceId) return;
    const sub = (table: string, cb: () => void) =>
      supabase.channel(`${table}_changes`).on("postgres_changes",
        { event: "*", schema: "public", table, filter: `workspace_id=eq.${workspaceId}` }, cb).subscribe();

    const subs = [
      sub("spaces", refreshSpaces),
      sub("projects", () => { refreshSpaces(); debouncedRefreshTaskCounts(); }),
      sub("sprint_folders", refreshSpaces),
      sub("sprints", () => { refreshSpaces(); debouncedRefreshTaskCounts(); }),
      sub("statuses", refreshStatuses),
    ];
    return () => { subs.forEach((s) => s.unsubscribe()); };
  }, [workspaceId, supabase, refreshSpaces, refreshStatuses, debouncedRefreshTaskCounts]);

  // Task changes subscription
  useEffect(() => {
    const pIds = getProjectIds(spaces), sIds = getSprintIds(spaces);
    if (pIds.length === 0 && sIds.length === 0) return;
    const filter = `or(project_id.in.(${pIds.join(",")}),sprint_id.in.(${sIds.join(",")}))`;
    const ch = supabase.channel("tasks_changes").on("postgres_changes",
      { event: "*", schema: "public", table: "tasks", filter }, debouncedRefreshTaskCounts).subscribe();
    return () => { ch.unsubscribe(); };
  }, [spaces, supabase, debouncedRefreshTaskCounts]);

  return { spaces, setSpaces, statuses, taskCounts, isLoading, refreshSpaces, refreshStatuses, refreshTaskCounts, debouncedRefreshTaskCounts };
}
