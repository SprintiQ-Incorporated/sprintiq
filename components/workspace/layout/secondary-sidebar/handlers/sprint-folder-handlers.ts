import { createClientSupabaseClient } from "@/lib/supabase/client";
import type { SprintFolderBase } from "../types";

interface SprintFolderHandlersConfig {
  onSuccess: () => void;
  onError: (error: Error) => void;
}

export function createSprintFolderHandlers({ onSuccess, onError }: SprintFolderHandlersConfig) {
  const supabase = createClientSupabaseClient();

  const createSprintFolder = async (
    name: string,
    spaceId: string,
    projectId?: string
  ): Promise<SprintFolderBase | null> => {
    try {
      const { data, error } = await supabase
        .from("sprint_folders")
        .insert({
          name: name.trim(),
          space_id: spaceId,
          project_id: projectId ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      onSuccess();
      return data;
    } catch (err) {
      console.error("Failed to create sprint folder:", err);
      onError(err instanceof Error ? err : new Error("Failed to create sprint folder"));
      return null;
    }
  };

  const renameSprintFolder = async (folderId: string, newName: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("sprint_folders")
        .update({ name: newName.trim(), updated_at: new Date().toISOString() })
        .eq("id", folderId);

      if (error) throw error;
      onSuccess();
      return true;
    } catch (err) {
      console.error("Failed to rename sprint folder:", err);
      onError(err instanceof Error ? err : new Error("Failed to rename sprint folder"));
      return false;
    }
  };

  const deleteSprintFolder = async (folderId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("sprint_folders")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", folderId);

      if (error) throw error;
      onSuccess();
      return true;
    } catch (err) {
      console.error("Failed to delete sprint folder:", err);
      onError(err instanceof Error ? err : new Error("Failed to delete sprint folder"));
      return false;
    }
  };

  return {
    createSprintFolder,
    renameSprintFolder,
    deleteSprintFolder,
  };
}
