import { createClientSupabaseClient } from "@/lib/supabase/client";
import { fetchWithCsrf } from "@/lib/csrf-client";
import type { Sprint } from "../types";

interface SprintHandlersConfig {
  workspaceId: string;
  onSuccess: () => void;
  onError: (error: Error) => void;
}

export function createSprintHandlers({ workspaceId, onSuccess, onError }: SprintHandlersConfig) {
  const supabase = createClientSupabaseClient();

  const createSprint = async (
    name: string,
    sprintFolderId: string,
    spaceId?: string
  ): Promise<Sprint | null> => {
    try {
      const { data, error } = await supabase
        .from("sprints")
        .insert({
          name: name.trim(),
          sprint_folder_id: sprintFolderId,
          status: "planned" as const,
          space_id: spaceId ?? "",
          workspace_id: workspaceId,
        })
        .select()
        .single();

      if (error) throw error;
      onSuccess();
      return data;
    } catch (err) {
      console.error("Failed to create sprint:", err);
      onError(err instanceof Error ? err : new Error("Failed to create sprint"));
      return null;
    }
  };

  const renameSprint = async (sprintId: string, newName: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("sprints")
        .update({ name: newName.trim(), updated_at: new Date().toISOString() })
        .eq("id", sprintId);

      if (error) throw error;
      onSuccess();
      return true;
    } catch (err) {
      console.error("Failed to rename sprint:", err);
      onError(err instanceof Error ? err : new Error("Failed to rename sprint"));
      return false;
    }
  };

  const deleteSprint = async (sprintId: string): Promise<boolean> => {
    try {
      const timestamp = new Date().toISOString();

      // Unlink tasks from this sprint before deleting it
      // This prevents tasks from becoming orphaned (pointing to a deleted sprint)
      const { error: unlinkError } = await supabase
        .from("tasks")
        .update({ sprint_id: null, updated_at: timestamp })
        .eq("sprint_id", sprintId);

      if (unlinkError) throw unlinkError;

      const { error } = await supabase
        .from("sprints")
        .update({ deleted_at: timestamp })
        .eq("id", sprintId);

      if (error) throw error;
      onSuccess();
      return true;
    } catch (err) {
      console.error("Failed to delete sprint:", err);
      onError(err instanceof Error ? err : new Error("Failed to delete sprint"));
      return false;
    }
  };

  const updateSprintStatus = async (
    sprintId: string,
    status: "planning" | "active" | "completed"
  ): Promise<boolean> => {
    try {
      const updates: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === "active") {
        updates.started_at = new Date().toISOString();
      } else if (status === "completed") {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("sprints")
        .update(updates)
        .eq("id", sprintId);

      if (error) throw error;
      onSuccess();
      return true;
    } catch (err) {
      console.error("Failed to update sprint status:", err);
      onError(err instanceof Error ? err : new Error("Failed to update sprint status"));
      return false;
    }
  };

  const archiveSprint = async (
    sprintId: string,
    workspaceId: string,
    notes?: string
  ): Promise<{ success: boolean; projectClosed?: boolean }> => {
    try {
      const response = await fetchWithCsrf(
        `/api/workspace/${workspaceId}/sprints/${sprintId}/archive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to archive sprint");
      }

      const data = await response.json();
      const projectClosed = !!(data.projectClosed && data.projectId);

      // If the project was closed out (no remaining work), notify the sidebar
      if (projectClosed) {
        window.dispatchEvent(
          new CustomEvent("projectDeleted", { detail: { projectId: data.projectId } })
        );
      }

      onSuccess();
      return { success: true, projectClosed };
    } catch (err) {
      console.error("Failed to archive sprint:", err);
      onError(err instanceof Error ? err : new Error("Failed to archive sprint"));
      return { success: false };
    }
  };

  return {
    createSprint,
    renameSprint,
    deleteSprint,
    updateSprintStatus,
    archiveSprint,
  };
}
