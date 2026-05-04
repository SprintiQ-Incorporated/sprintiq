import { useEffect } from "react";
import type { Workspace, Project } from "@/lib/database-aliases";

interface UseRealtimeSubscriptionsProps {
  supabase: any;
  workspace: Workspace;
  project: Project;
  refreshTasks: () => Promise<void>;
  refreshStatuses: () => Promise<void>;
  loadAllSubtasks: () => Promise<void>;
}

export const useRealtimeSubscriptions = ({
  supabase,
  workspace,
  project,
  refreshTasks,
  refreshStatuses,
  loadAllSubtasks,
}: UseRealtimeSubscriptionsProps) => {
  useEffect(() => {
    if (!project?.id || !workspace?.id) return;

    const tasksChannel = supabase
      .channel(`project_tasks_${project.id}_${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `project_id=eq.${project.id}`,
        },
        () => {
          refreshTasks();
          loadAllSubtasks();
        }
      )
      .subscribe();

    const statusesChannel = supabase
      .channel(`workspace_statuses_${workspace.id}_${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "statuses",
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => {
          refreshStatuses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(statusesChannel);
    };
  }, [
    supabase,
    project?.id,
    workspace?.id,
    refreshTasks,
    refreshStatuses,
    loadAllSubtasks,
  ]);
};
