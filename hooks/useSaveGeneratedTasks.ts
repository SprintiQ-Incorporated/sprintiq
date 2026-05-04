import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { csrfFetch } from "@/hooks/useCsrfFetch";
import type {
  SaveGeneratedTasksRequest,
  SaveGeneratedTasksResponse,
} from "@/types/api/saveGeneratedTasks";

interface GeneratedTask {
  title: string;
  description?: string;
  storyText?: string;
  acceptanceCriteria?: string[];
  storyPoints?: number;
  priority?: "low" | "medium" | "high" | "critical";
  estimatedHours?: number;
  assigneeId?: string;
}

interface UseSaveGeneratedTasksOptions {
  onSuccess?: (result: SaveGeneratedTasksResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * React hook for saving AI-generated tasks to a project using the unified API.
 *
 * @example
 * ```tsx
 * const { saveToProject, isSaving, lastResult } = useSaveGeneratedTasks({
 *   onSuccess: (result) => {
 *
 *   },
 * });
 *
 * const handleSave = async () => {
 *   await saveToProject(generatedStories, selectedProjectId, {
 *     generationSessionId: sessionId,
 *   });
 * };
 * ```
 */
export function useSaveGeneratedTasks(
  options: UseSaveGeneratedTasksOptions = {}
) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastResult, setLastResult] =
    useState<SaveGeneratedTasksResponse | null>(null);
  const { toast } = useToast();

  const saveToProject = useCallback(
    async (
      tasks: GeneratedTask[],
      projectId: string,
      additionalContext?: {
        generationSessionId?: string;
        sprintId?: string;
      }
    ): Promise<SaveGeneratedTasksResponse | null> => {
      // Validation
      if (!projectId) {
        const err = new Error("Project ID is required");
        setError(err);
        toast({
          title: "Error",
          description: "Please select a project before saving",
          variant: "destructive",
        });
        options.onError?.(err);
        return null;
      }

      if (!tasks || tasks.length === 0) {
        const err = new Error("No tasks to save");
        setError(err);
        toast({
          title: "Error",
          description: "No stories to save",
          variant: "destructive",
        });
        options.onError?.(err);
        return null;
      }

      setIsSaving(true);
      setError(null);

      try {
        const response = await csrfFetch("/api/tasks/save-generated", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tasks,
            projectId,
            ...additionalContext,
          } as SaveGeneratedTasksRequest),
        });

        const result: SaveGeneratedTasksResponse = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to save tasks");
        }

        setLastResult(result);

        toast({
          title: "Success",
          description: `${result.savedCount} stories saved to project`,
        });

        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);

        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });

        options.onError?.(error);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [toast, options]
  );

  const reset = useCallback(() => {
    setError(null);
    setLastResult(null);
  }, []);

  return {
    saveToProject,
    isSaving,
    error,
    lastResult,
    reset,
  };
}
