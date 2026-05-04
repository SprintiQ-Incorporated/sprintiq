/** Space CRUD handlers - pure data operations */
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { generateSpaceId } from "@/lib/branded-ids";
import { cascadeDeleteSpace } from "@/lib/services/spaceService";
import type { Space, CascadeDeleteResult } from "../types";

interface SpaceHandlersConfig {
  workspaceId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function createSpaceHandlers({ workspaceId, onSuccess, onError }: SpaceHandlersConfig) {
  const supabase = createClientSupabaseClient();

  const createSpace = async (name: string): Promise<Space | null> => {
    try {
      const { data, error } = await supabase
        .from("spaces")
        .insert({
          name: name.trim(),
          workspace_id: workspaceId,
          space_id: generateSpaceId(),
        })
        .select()
        .single();

      if (error) throw error;
      onSuccess?.();
      return data;
    } catch (err) {
      console.error("Failed to create space:", err);
      onError?.(err instanceof Error ? err : new Error("Failed to create space"));
      return null;
    }
  };

  const renameSpace = async (spaceId: string, newName: string): Promise<boolean> => {
    if (!newName.trim()) return false;

    try {
      const { error } = await supabase
        .from("spaces")
        .update({ name: newName.trim(), updated_at: new Date().toISOString() })
        .eq("space_id", spaceId);

      if (error) throw error;
      onSuccess?.();
      return true;
    } catch (err) {
      console.error("Failed to rename space:", err);
      onError?.(err instanceof Error ? err : new Error("Failed to rename space"));
      return false;
    }
  };

  const deleteSpace = async (spaceId: string): Promise<CascadeDeleteResult> => {
    try {
      const result = await cascadeDeleteSpace(supabase, spaceId);
      if (!result.success) throw new Error(result.error || "Failed to delete space");
      onSuccess?.();
      return result;
    } catch (err) {
      console.error("Failed to delete space:", err);
      onError?.(err instanceof Error ? err : new Error("Failed to delete space"));
      const emptyCounts = { tasks: 0, statuses: 0, projects: 0, sprints: 0, sprintFolders: 0 };
      return { success: false, error: err instanceof Error ? err.message : "Failed to delete space", deletedCounts: emptyCounts };
    }
  };

  return {
    createSpace,
    renameSpace,
    deleteSpace,
  };
}
