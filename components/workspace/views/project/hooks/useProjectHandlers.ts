import { useCallback, useState } from "react";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";
import type { Project } from "@/lib/database-aliases";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

interface UseProjectHandlersProps {
  workspaceId: string;
  projectId: string;
  spaceId: string;
  project: Project;
  setLocalProject: (updater: (prev: Project) => Project) => void;
  router: AppRouterInstance;
}

export const useProjectHandlers = ({
  workspaceId,
  projectId,
  spaceId,
  project,
  setLocalProject,
  router,
}: UseProjectHandlersProps) => {
  const [supabase] = useState(() => createClientSupabaseClient());
  const { toast } = useEnhancedToast();

  const handleRenameProject = useCallback(
    async (newName: string): Promise<boolean> => {
      if (!newName.trim()) return false;

      try {
        const { error } = await supabase
          .from("projects")
          .update({ name: newName.trim() })
          .eq("project_id", project.project_id);

        if (error) throw error;

        setLocalProject((prev) => ({
          ...prev,
          name: newName.trim(),
        }));

        window.dispatchEvent(
          new CustomEvent("projectRenamed", {
            detail: { project, newName: newName.trim() },
          })
        );

        toast({
          title: "Project renamed",
          description: `Project renamed to "${newName.trim()}".`,
        });

        return true;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Something went wrong";
        console.error("Error renaming project:", error);
        toast({
          title: "Error renaming project",
          description: message,
          variant: "destructive",
        });
        return false;
      }
    },
    [supabase, toast, project.project_id, project, setLocalProject]
  );

  const handleCopyProjectLink = useCallback(async () => {
    try {
      const url = `${window.location.origin}/${workspaceId}/space/${spaceId}/project/${projectId}`;
      await navigator.clipboard.writeText(url);

      toast({
        title: "Link copied",
        description: "Project link copied to clipboard.",
      });
    } catch (error) {
      console.error("Error copying link:", error);
      toast({
        title: "Error copying link",
        description: "Failed to copy link to clipboard.",
        variant: "destructive",
      });
    }
  }, [workspaceId, spaceId, projectId, toast]);

  const handleDeleteProject = useCallback(async (): Promise<boolean> => {
    try {
      const timeStamp = new Date().toISOString();

      // 1. Soft delete all tasks for this project
      const { error: tasksError } = await supabase
        .from("tasks")
        .update({ deleted_at: timeStamp })
        .eq("project_id", project.id);

      if (tasksError) {
        console.error("Error deleting project tasks:", tasksError);
        throw tasksError;
      }

      // 2. Soft delete all statuses for this project
      const { error: statusesError } = await supabase
        .from("statuses")
        .update({ deleted_at: timeStamp })
        .eq("project_id", project.id);

      if (statusesError) {
        console.error("Error deleting project statuses:", statusesError);
        throw statusesError;
      }

      // 3. Soft delete the project itself
      const { error: deleteError } = await supabase
        .from("projects")
        .update({ deleted_at: timeStamp })
        .eq("id", project.id);

      if (deleteError) {
        console.error("Error deleting project:", deleteError);
        throw deleteError;
      }

      // Emit event to update secondary sidebar
      window.dispatchEvent(
        new CustomEvent("projectDeleted", {
          detail: { project },
        })
      );

      toast({
        title: "Project deleted",
        description: "Project and all its related data have been deleted.",
      });

      // Navigate to home
      router.push(`/${workspaceId}/home`);
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      toast({
        title: "Error deleting project",
        description: message,
        variant: "destructive",
      });
      return false;
    }
  }, [supabase, toast, router, workspaceId, project.id, project]);

  return {
    handleRenameProject,
    handleCopyProjectLink,
    handleDeleteProject,
  };
};
