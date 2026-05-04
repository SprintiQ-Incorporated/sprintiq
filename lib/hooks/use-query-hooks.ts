/**
 * React Query Hooks for SprintiQ Data Fetching
 * Replaces manual useState + useEffect patterns with optimized caching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { csrfFetch } from "@/hooks/useCsrfFetch";

const supabase = createClientSupabaseClient();

// ============================================================================
// QUERY KEYS - Centralized for consistency
// ============================================================================

export const queryKeys = {
  // Workspace queries
  workspaces: ['workspaces'] as const,
  workspace: (id: string) => ['workspace', id] as const,
  workspaceAnalytics: (id: string, days?: number) => 
    ['workspace', id, 'analytics', days ?? 30] as const,

  // Sprint queries
  sprints: (workspaceId: string) => ['sprints', workspaceId] as const,
  sprint: (id: string) => ['sprint', id] as const,
  sprintData: (sprintId: string, workspaceId: string) => 
    ['sprint', sprintId, 'data', workspaceId] as const,

  // Task queries
  tasks: (workspaceId: string) => ['tasks', workspaceId] as const,
  task: (id: string) => ['task', id] as const,
  tasksByProject: (projectId: string) => ['tasks', 'project', projectId] as const,
  tasksBySprint: (sprintId: string) => ['tasks', 'sprint', sprintId] as const,

  // Team queries
  teams: (workspaceId: string) => ['teams', workspaceId] as const,
  team: (id: string) => ['team', id] as const,
  teamMembers: (workspaceId: string) => ['team-members', workspaceId] as const,
  teamMember: (id: string) => ['team-member', id] as const,

  // Project queries
  projects: (workspaceId: string) => ['projects', workspaceId] as const,
  project: (id: string) => ['project', id] as const,
  projectData: (projectId: string, workspaceId: string) => 
    ['project', projectId, 'data', workspaceId] as const,
};

// ============================================================================
// SPRINT QUERIES
// ============================================================================

/**
 * Fetch sprint view data using optimized RPC function
 * Replaces 4+ separate queries with single call
 */
export function useSprintData(sprintId: string, workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.sprintData(sprintId, workspaceId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_sprint_view_data', {
        p_sprint_id: sprintId,
        p_workspace_id: workspaceId,
      });

      if (error) {
        logger.error('Failed to fetch sprint data', error);
        throw error;
      }

      const row = (data?.[0] as any) || {};

      return {
        tasks: row.tasks || [],
        statuses: row.statuses || [],
        team_members: row.team_members || [],
        sprint: row.sprint || null,
      };
    },
    enabled: !!sprintId && !!workspaceId,
  });
}

/**
 * Fetch all sprints for a workspace
 */
export function useSprints(workspaceId: string) {
  return useQuery({
    queryKey: queryKeys.sprints(workspaceId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sprints')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });
}

// ============================================================================
// WORKSPACE QUERIES
// ============================================================================

/**
 * Fetch workspace analytics using RPC function
 */
export function useWorkspaceAnalytics(workspaceId: string, daysBack: number = 30) {
  return useQuery({
    queryKey: queryKeys.workspaceAnalytics(workspaceId, daysBack),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_workspace_analytics', {
        p_workspace_id: workspaceId,
        p_days_back: daysBack,
      });

      if (error) {
        logger.error('Failed to fetch workspace analytics', error);
        throw error;
      }

      const analytics = (data?.[0] as any) || {
        total_tasks: 0,
        completed_tasks: 0,
        active_sprints: 0,
        team_members_count: 0,
        recent_activity: 0,
        completion_rate: 0,
        average_story_points: 0,
      };

      return {
        total_tasks: analytics.total_tasks,
        completed_tasks: analytics.completed_tasks,
        active_sprints: analytics.active_sprints,
        team_members_count: analytics.team_members_count,
        recent_activity: analytics.recent_activity,
        completion_rate: analytics.completion_rate,
        average_story_points: analytics.average_story_points,
      };
    },
    enabled: !!workspaceId,
    staleTime: 2 * 60 * 1000, // 2 minutes for analytics
  });
}

// ============================================================================
// TASK MUTATIONS WITH OPTIMISTIC UPDATES
// ============================================================================

interface CreateTaskParams {
  workspaceId: string;
  projectId?: string;
  sprintId?: string;
  title: string;
  description?: string;
  status_id?: string;
}

/**
 * Create task mutation with optimistic update
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateTaskParams) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          workspace_id: params.workspaceId,
          project_id: params.projectId,
          sprint_id: params.sprintId,
          name: params.title, // 'name' field in database
          description: params.description,
          status_id: params.status_id || '', // Required field
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    // Optimistic update
    onMutate: async (newTask) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.tasks(newTask.workspaceId) 
      });

      // Snapshot previous value
      const previousTasks = queryClient.getQueryData(
        queryKeys.tasks(newTask.workspaceId)
      );

      // Optimistically update to new value
      queryClient.setQueryData(
        queryKeys.tasks(newTask.workspaceId),
        (old: any) => {
          if (!old) return [{ ...newTask, id: 'temp-' + Date.now() }];
          return [...old, { ...newTask, id: 'temp-' + Date.now() }];
        }
      );

      return { previousTasks };
    },
    // Rollback on error
    onError: (err, newTask, context) => {
      queryClient.setQueryData(
        queryKeys.tasks(newTask.workspaceId),
        context?.previousTasks
      );
      logger.error('Failed to create task', err);
    },
    // Refetch on success
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.tasks(variables.workspaceId) 
      });
      if (variables.sprintId) {
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.sprintData(variables.sprintId, variables.workspaceId) 
        });
      }
    },
  });
}

/**
 * Update task mutation with optimistic update and rollback on failure
 * Implements full React Query mutation lifecycle for instant UI feedback
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, updates }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.task(id) });
      
      // Snapshot the previous value for rollback
      const previousTask = queryClient.getQueryData(queryKeys.task(id));
      
      // Get current task to access workspace/project/sprint IDs
      const currentTask = previousTask as any;
      const workspaceId = currentTask?.workspace_id;
      const projectId = currentTask?.project_id;
      const sprintId = currentTask?.sprint_id;

      // Cancel queries for all related task lists
      if (workspaceId) {
        await queryClient.cancelQueries({ queryKey: queryKeys.tasks(workspaceId) });
      }
      if (projectId) {
        await queryClient.cancelQueries({ queryKey: queryKeys.tasksByProject(projectId) });
        await queryClient.cancelQueries({ queryKey: queryKeys.projectData(projectId, workspaceId) });
      }
      if (sprintId && workspaceId) {
        await queryClient.cancelQueries({ queryKey: queryKeys.tasksBySprint(sprintId) });
        await queryClient.cancelQueries({ queryKey: queryKeys.sprintData(sprintId, workspaceId) });
      }

      // Snapshot previous values for all task lists
      const previousWorkspaceTasks = workspaceId 
        ? queryClient.getQueryData(queryKeys.tasks(workspaceId)) 
        : null;
      const previousProjectTasks = projectId 
        ? queryClient.getQueryData(queryKeys.tasksByProject(projectId)) 
        : null;
      const previousSprintTasks = sprintId 
        ? queryClient.getQueryData(queryKeys.tasksBySprint(sprintId)) 
        : null;

      // Optimistically update individual task cache
      queryClient.setQueryData(queryKeys.task(id), (old: any) => ({
        ...old,
        ...updates,
      }));

      // Optimistically update workspace tasks list
      if (workspaceId) {
        queryClient.setQueryData(queryKeys.tasks(workspaceId), (old: any) => {
          if (!old) return old;
          return old.map((t: any) => 
            t.id === id ? { ...t, ...updates } : t
          );
        });
      }

      // Optimistically update project tasks list
      if (projectId) {
        queryClient.setQueryData(queryKeys.tasksByProject(projectId), (old: any) => {
          if (!old) return old;
          return old.map((t: any) => 
            t.id === id ? { ...t, ...updates } : t
          );
        });
      }

      // Optimistically update sprint tasks list
      if (sprintId) {
        queryClient.setQueryData(queryKeys.tasksBySprint(sprintId), (old: any) => {
          if (!old) return old;
          return old.map((t: any) => 
            t.id === id ? { ...t, ...updates } : t
          );
        });
      }

      // Return context for rollback
      return { 
        previousTask,
        previousWorkspaceTasks,
        previousProjectTasks,
        previousSprintTasks,
        workspaceId,
        projectId,
        sprintId,
      };
    },
    onError: (err, { id }, context) => {
      // Rollback all optimistic updates on error
      if (context) {
        queryClient.setQueryData(queryKeys.task(id), context.previousTask);
        
        if (context.workspaceId && context.previousWorkspaceTasks) {
          queryClient.setQueryData(
            queryKeys.tasks(context.workspaceId), 
            context.previousWorkspaceTasks
          );
        }
        
        if (context.projectId && context.previousProjectTasks) {
          queryClient.setQueryData(
            queryKeys.tasksByProject(context.projectId), 
            context.previousProjectTasks
          );
        }
        
        if (context.sprintId && context.previousSprintTasks) {
          queryClient.setQueryData(
            queryKeys.tasksBySprint(context.sprintId), 
            context.previousSprintTasks
          );
        }
      }
      
      logger.error('Failed to update task', err);
    },
    onSettled: (data, err, { id }, context) => {
      // Always refetch to ensure cache is in sync with server
      queryClient.invalidateQueries({ queryKey: queryKeys.task(id) });
      
      if (context?.workspaceId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks(context.workspaceId) });
      }
      
      if (context?.projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tasksByProject(context.projectId) });
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.projectData(context.projectId, context.workspaceId) 
        });
      }
      
      if (context?.sprintId && context?.workspaceId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tasksBySprint(context.sprintId) });
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.sprintData(context.sprintId, context.workspaceId) 
        });
      }
    },
  });
}

/**
 * Delete task mutation
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('tasks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;
      return taskId;
    },
    onSuccess: (taskId, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) });
      // Invalidate all task queries
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// ============================================================================
// TEAM MEMBER MUTATIONS
// ============================================================================

/**
 * Create team member mutation
 */
export function useCreateTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberData: any) => {
      const response = await csrfFetch(
        `/api/workspace/${memberData.workspace_id}/teams/${memberData.team_id}/members`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(memberData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create team member');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.teamMembers(variables.workspace_id) 
      });
    },
  });
}
