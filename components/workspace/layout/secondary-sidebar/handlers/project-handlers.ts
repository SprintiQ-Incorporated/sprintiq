import { createClientSupabaseClient } from "@/lib/supabase/client";
import { generateProjectId } from "@/lib/branded-ids";
import type { Project } from "../types";

interface ProjectHandlersConfig {
  workspaceId: string;
  onSuccess: () => void;
  onError: (error: Error) => void;
}

export function createProjectHandlers({ workspaceId, onSuccess, onError }: ProjectHandlersConfig) {
  const supabase = createClientSupabaseClient();

  const createProject = async (
    name: string,
    spaceId: string
  ): Promise<Project | null> => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          name: name.trim(),
          space_id: spaceId,
          workspace_id: workspaceId,
          project_id: generateProjectId(),
        })
        .select()
        .single();

      if (error) throw error;
      onSuccess();
      return data;
    } catch (err) {
      console.error("Failed to create project:", err);
      onError(err instanceof Error ? err : new Error("Failed to create project"));
      return null;
    }
  };

  const renameProject = async (projectId: string, newName: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("projects")
        .update({ name: newName.trim(), updated_at: new Date().toISOString() })
        .eq("id", projectId);

      if (error) throw error;
      onSuccess();
      return true;
    } catch (err) {
      console.error("Failed to rename project:", err);
      onError(err instanceof Error ? err : new Error("Failed to rename project"));
      return false;
    }
  };

  const deleteProject = async (projectId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("projects")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", projectId);

      if (error) throw error;
      window.dispatchEvent(
        new CustomEvent("projectDeleted", { detail: { projectId } })
      );
      onSuccess();
      return true;
    } catch (err) {
      console.error("Failed to delete project:", err);
      onError(err instanceof Error ? err : new Error("Failed to delete project"));
      return false;
    }
  };

  return {
    createProject,
    renameProject,
    deleteProject,
  };
}
