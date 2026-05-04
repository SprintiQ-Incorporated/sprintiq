"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEnhancedToast } from "@/hooks/use-enhanced-toast";

/**
 * Supported entity types for renaming
 */
export type RenameableEntityType = "workspace" | "portfolio" | "project" | "sprint" | "task";

/**
 * Options for the rename mutation
 */
interface UseRenameEntityOptions {
  /**
   * Additional query keys to invalidate on success
   */
  additionalInvalidateKeys?: string[][];

  /**
   * Callback on successful rename
   */
  onSuccess?: (data: any, newName: string) => void;

  /**
   * Callback on rename error
   */
  onError?: (error: Error, newName: string) => void;

  /**
   * Custom success message
   */
  successMessage?: string;

  /**
   * Custom error message
   */
  errorMessage?: string;
}

/**
 * Hook for renaming entities with optimistic updates
 *
 * Uses React Query's useMutation with:
 * - Optimistic UI updates for instant feedback
 * - Automatic rollback on error
 * - Cache invalidation on success
 * - Toast notifications
 *
 * @example
 * ```tsx
 * const { mutate: rename, isPending } = useRenameEntity('project', projectId);
 *
 * // In your component:
 * <EditableText
 *   value={name}
 *   onSave={(newName) => rename(newName)}
 *   disabled={isPending}
 * />
 * ```
 */
export function useRenameEntity<T extends RenameableEntityType>(
  entityType: T,
  entityId: string,
  options: UseRenameEntityOptions = {}
) {
  const queryClient = useQueryClient();
  const { toast } = useEnhancedToast();

  const {
    additionalInvalidateKeys = [],
    onSuccess,
    onError,
    successMessage,
    errorMessage,
  } = options;

  // Primary query key for this entity
  const queryKey = [entityType, entityId];

  // Determine the API endpoint based on entity type
  const getEndpoint = () => {
    switch (entityType) {
      case "workspace":
        return `/api/workspaces/${entityId}`;
      case "portfolio":
        return `/api/portfolios/${entityId}`;
      case "project":
        return `/api/projects/${entityId}`;
      case "sprint":
        return `/api/sprints/${entityId}`;
      case "task":
        return `/api/tasks/${entityId}`;
      default:
        return `/api/${entityType}s/${entityId}`;
    }
  };

  return useMutation({
    mutationFn: async (newName: string) => {
      const trimmedName = newName.trim();

      if (!trimmedName) {
        throw new Error("Name cannot be empty");
      }

      const res = await fetch(getEndpoint(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Rename failed");
      }

      return res.json();
    },

    onMutate: async (newName: string) => {
      const trimmedName = newName.trim();

      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previous = queryClient.getQueryData(queryKey);

      // Optimistically update the cache
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          name: trimmedName,
        };
      });

      // Also update any list queries that might contain this entity
      const listQueryKey = [`${entityType}s`];
      queryClient.setQueriesData({ queryKey: listQueryKey }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map((item: any) =>
          item.id === entityId ? { ...item, name: trimmedName } : item
        );
      });

      // Return context with the previous value for rollback
      return { previous, trimmedName };
    },

    onError: (err: Error, newName: string, context) => {
      // Rollback to the previous value on error
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }

      // Show error toast
      toast({
        title: "Error",
        description: errorMessage || `Failed to rename ${entityType}. Please try again.`,
        variant: "destructive",
      });

      // Call custom error handler
      onError?.(err, newName);
    },

    onSuccess: (data, newName: string) => {
      // Show success toast
      toast({
        title: "Success",
        description:
          successMessage ||
          `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} renamed successfully`,
      });

      // Call custom success handler
      onSuccess?.(data, newName);
    },

    onSettled: () => {
      // Always refetch after error or success to ensure cache is in sync
      queryClient.invalidateQueries({ queryKey });

      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: [`${entityType}s`] });

      // Invalidate any additional query keys
      additionalInvalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
}

/**
 * Hook for renaming a workspace
 */
export function useRenameWorkspace(
  workspaceId: string,
  options?: UseRenameEntityOptions
) {
  return useRenameEntity("workspace", workspaceId, options);
}

/**
 * Hook for renaming a portfolio
 */
export function useRenamePortfolio(
  portfolioId: string,
  options?: UseRenameEntityOptions
) {
  return useRenameEntity("portfolio", portfolioId, options);
}

/**
 * Hook for renaming a project
 */
export function useRenameProject(
  projectId: string,
  options?: UseRenameEntityOptions
) {
  return useRenameEntity("project", projectId, options);
}

/**
 * Hook for renaming a sprint
 */
export function useRenameSprint(
  sprintId: string,
  options?: UseRenameEntityOptions
) {
  return useRenameEntity("sprint", sprintId, options);
}

/**
 * Hook for renaming a task
 */
export function useRenameTask(
  taskId: string,
  options?: UseRenameEntityOptions
) {
  return useRenameEntity("task", taskId, options);
}

/**
 * Hook for batch renaming multiple entities
 * Useful for drag-and-drop reordering scenarios
 */
export function useBatchRename<T extends RenameableEntityType>(
  entityType: T
) {
  const queryClient = useQueryClient();
  const { toast } = useEnhancedToast();

  return useMutation({
    mutationFn: async (updates: Array<{ id: string; name: string }>) => {
      const results = await Promise.all(
        updates.map(async ({ id, name }) => {
          const res = await fetch(`/api/${entityType}s/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim() }),
          });

          if (!res.ok) {
            throw new Error(`Failed to rename ${entityType} ${id}`);
          }

          return res.json();
        })
      );

      return results;
    },

    onSuccess: () => {
      toast({
        title: "Success",
        description: `All ${entityType}s renamed successfully`,
      });
    },

    onError: (err: Error) => {
      toast({
        title: "Error",
        description: `Failed to rename some ${entityType}s. Please try again.`,
        variant: "destructive",
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [`${entityType}s`] });
    },
  });
}
