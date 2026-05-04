/**
 * React Query hooks for Analytics Insights Page
 * 
 * Provides comprehensive analytics data with automatic caching and refetching
 */

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { createClientSupabaseClient } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface AnalyticsMetrics {
  totalStories: number;
  completedStories: number;
  teamVelocity: number;
  avgCycleTime: number;
  onTrackSprints: number;
  blockedTasks: number;
}

export interface VelocityDataPoint {
  sprint: string;
  planned: number;
  completed: number;
  velocity: number;
}

export interface BurndownDataPoint {
  day: string;
  ideal: number;
  actual: number;
  remaining: number;
}

export interface CumulativeFlowDataPoint {
  date: string;
  todo: number;
  review: number;
  inProgress: number;
  done: number;
}

export interface CompletionData {
  completed: number;
  inProgress: number;
  pending: number;
}

export interface AnalyticsInsightsData {
  metrics: AnalyticsMetrics;
  velocityData: VelocityDataPoint[];
  burndownData: BurndownDataPoint[];
  cumulativeFlowData: CumulativeFlowDataPoint[];
  completionData: CompletionData;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Fetch and calculate comprehensive analytics insights
 * 
 * @param workspaceId - The workspace ID
 * @returns Query result with analytics data
 * 
 * @example
 * ```tsx
 * function AnalyticsPage({ workspaceId }: Props) {
 *   const { data, isLoading, refetch } = useAnalyticsInsights(workspaceId);
 * 
 *   if (isLoading) return <LoadingPage />;
 * 
 *   return (
 *     <AnalyticsDashboard
 *       metrics={data.metrics}
 *       velocityData={data.velocityData}
 *       onRefresh={refetch}
 *     />
 *   );
 * }
 * ```
 */
export function useAnalyticsInsights(
  workspaceId: string
): UseQueryResult<AnalyticsInsightsData> {
  return useQuery({
    queryKey: ["analytics-insights", workspaceId],
    queryFn: async () => {
      const supabase = createClientSupabaseClient();

      // Get workspace UUID
      const { data: workspaceData, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .maybeSingle();

      if (workspaceError || !workspaceData) {
        throw new Error("Workspace not found");
      }

      const workspaceUuid = workspaceData.id;

      // Fetch tasks, sprints, and statuses in parallel
      const [tasksData, sprintsData, statusesData] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, status_id, story_points, created_at, updated_at, sprint_id")
          .eq("workspace_id", workspaceUuid)
          .is("deleted_at", null),
        supabase
          .from("sprints")
          .select("id, sprint_id, name, start_date, end_date")
          .eq("workspace_id", workspaceUuid)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("statuses")
          .select("id, name, type")
          .eq("workspace_id", workspaceUuid),
      ]);

      const tasks = tasksData.data || [];
      const sprints = sprintsData.data || [];
      const statuses = statusesData.data || [];

      // Build status ID Sets for O(1) lookup instead of O(n) .some() calls
      const completedStatusIds = new Set(
        statuses
          .filter((s) => s.type === "done" || s.name.toLowerCase().includes("done"))
          .map((s) => s.id)
      );
      const inProgressStatusIds = new Set(
        statuses
          .filter(
            (s) =>
              s.type === "in_progress" ||
              s.name.toLowerCase().includes("progress") ||
              s.name.toLowerCase().includes("development")
          )
          .map((s) => s.id)
      );
      const blockedStatusIds = new Set(
        statuses
          .filter(
            (s) =>
              s.name.toLowerCase().includes("block") ||
              s.name.toLowerCase().includes("stuck")
          )
          .map((s) => s.id)
      );

      // Pre-group tasks by sprint_id using Map for O(1) lookup instead of O(n) filtering
      const tasksBySprintId = new Map<string, typeof tasks>();
      tasks.forEach((task) => {
        if (task.sprint_id) {
          const existing = tasksBySprintId.get(task.sprint_id) || [];
          existing.push(task);
          tasksBySprintId.set(task.sprint_id, existing);
        }
      });

      // Calculate metrics using Sets for O(1) status checks
      const totalStories = tasks.length;
      const completedStories = tasks.filter((t) => completedStatusIds.has(t.status_id)).length;
      const inProgressStories = tasks.filter((t) => inProgressStatusIds.has(t.status_id)).length;
      const pendingStories = totalStories - completedStories - inProgressStories;
      const blockedTasks = tasks.filter((t) => blockedStatusIds.has(t.status_id)).length;

      // Calculate velocity data from last 6 sprints using pre-grouped tasks
      const recentSprints = sprints.slice(0, 6).reverse();
      const velocityData: VelocityDataPoint[] = recentSprints.map((sprint, index) => {
        const sprintTasks = tasksBySprintId.get(sprint.id) || [];
        const plannedPoints = sprintTasks.reduce(
          (sum, t) => sum + (t.story_points || 0),
          0
        );
        const completedPoints = sprintTasks
          .filter((t) => completedStatusIds.has(t.status_id))
          .reduce((sum, t) => sum + (t.story_points || 0), 0);

        return {
          sprint: sprint.name || `Sprint ${index + 1}`,
          planned: plannedPoints,
          completed: completedPoints,
          velocity: completedPoints,
        };
      });

      // Calculate average velocity
      const avgVelocity =
        velocityData.length > 0
          ? Math.round(
              velocityData.reduce((sum, d) => sum + d.velocity, 0) /
                velocityData.length
            )
          : 0;

      // Calculate average cycle time from completed tasks (days from created to updated)
      const completedTaskEntries = tasks.filter((t) => completedStatusIds.has(t.status_id));
      const avgCycleTime =
        completedTaskEntries.length > 0
          ? Math.round(
              (completedTaskEntries.reduce((sum, t) => {
                const created = new Date(t.created_at!).getTime();
                const updated = new Date(t.updated_at!).getTime();
                return sum + (updated - created) / (1000 * 60 * 60 * 24);
              }, 0) /
                completedTaskEntries.length) *
                10
            ) / 10
          : 0;

      // Count on-track sprints using pre-grouped tasks
      const onTrackSprints = recentSprints.filter((sprint) => {
        const sprintTasks = tasksBySprintId.get(sprint.id) || [];
        const planned = sprintTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
        const done = sprintTasks
          .filter((t) => completedStatusIds.has(t.status_id))
          .reduce((sum, t) => sum + (t.story_points || 0), 0);
        return planned > 0 && done / planned >= 0.7;
      }).length;

      // Generate burndown data for current sprint from real task data
      const burndownData: BurndownDataPoint[] = [];
      const currentSprint = sprints[0];
      if (currentSprint && currentSprint.start_date && currentSprint.end_date) {
        const sprintTasks = tasksBySprintId.get(currentSprint.id) || [];
        const totalPoints = sprintTasks.reduce(
          (sum, t) => sum + (t.story_points || 0),
          0
        );

        const startMs = new Date(currentSprint.start_date).getTime();
        const endMs = new Date(currentSprint.end_date).getTime();
        const sprintDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

        // Collect completed task points by day offset using Set for O(1) lookup
        const completedByDay: Record<number, number> = {};
        sprintTasks
          .filter((t) => completedStatusIds.has(t.status_id))
          .forEach((t) => {
            const updatedMs = new Date(t.updated_at!).getTime();
            const dayOffset = Math.min(
              sprintDays,
              Math.max(0, Math.round((updatedMs - startMs) / (1000 * 60 * 60 * 24)))
            );
            completedByDay[dayOffset] = (completedByDay[dayOffset] || 0) + (t.story_points || 0);
          });

        let remaining = totalPoints;
        for (let day = 0; day <= sprintDays; day++) {
          const ideal = totalPoints - (totalPoints / sprintDays) * day;
          remaining -= completedByDay[day] || 0;
          burndownData.push({
            day: `Day ${day + 1}`,
            ideal: Math.max(0, Math.round(ideal)),
            actual: Math.max(0, Math.round(remaining)),
            remaining: Math.max(0, Math.round(remaining)),
          });
        }
      }

      // Generate cumulative flow data from real task creation/completion dates
      const cumulativeFlowData: CumulativeFlowDataPoint[] = [];
      if (tasks.length > 0) {
        const now = new Date();
        const weekCount = 8;
        for (let week = 1; week <= weekCount; week++) {
          const weekEnd = new Date(
            now.getTime() - (weekCount - week) * 7 * 24 * 60 * 60 * 1000
          );

          // Tasks that existed by this week (created before weekEnd)
          const existingTasks = tasks.filter(
            (t) => new Date(t.created_at!).getTime() <= weekEnd.getTime()
          );

          // Done: completed tasks whose updated_at is before weekEnd (using Set for O(1) lookup)
          const done = existingTasks.filter(
            (t) =>
              completedStatusIds.has(t.status_id) &&
              new Date(t.updated_at!).getTime() <= weekEnd.getTime()
          ).length;

          // In-progress: tasks in progress status that existed by weekEnd
          const inProgress = existingTasks.filter(
            (t) =>
              inProgressStatusIds.has(t.status_id) &&
              !completedStatusIds.has(t.status_id)
          ).length;

          // Review: approximate as tasks updated recently but not done or in-progress
          const review = existingTasks.filter((t) => {
            const isNotDone = !completedStatusIds.has(t.status_id);
            const isNotInProgress = !inProgressStatusIds.has(t.status_id);
            const updated = new Date(t.updated_at!).getTime();
            const created = new Date(t.created_at!).getTime();
            return isNotDone && isNotInProgress && updated > created;
          }).length;

          const todo = Math.max(
            0,
            existingTasks.length - done - inProgress - review
          );

          cumulativeFlowData.push({
            date: `Week ${week}`,
            todo,
            review,
            inProgress,
            done,
          });
        }
      }

      return {
        metrics: {
          totalStories,
          completedStories,
          teamVelocity: avgVelocity,
          avgCycleTime,
          onTrackSprints,
          blockedTasks,
        },
        velocityData,
        burndownData,
        cumulativeFlowData,
        completionData: {
          completed: completedStories,
          inProgress: inProgressStories,
          pending: pendingStories,
        },
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!workspaceId,
  });
}
