import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import { WORKSPACE_COLUMNS } from "@/lib/query-columns";
import { Metadata } from "next";
import Link from "next/link";
import {
  Heart,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  Target,
  Users,
  Clock,
} from "lucide-react";
import { AnalyticsBreadcrumb } from "@/components/analytics/AnalyticsBreadcrumb";
import { getStatusTypeColor, STATUS_TYPES } from "@/lib/status-utils";

interface HealthScorePageProps {
  params: Promise<{ workspaceId: string }>;
}

export const metadata: Metadata = {
  title: "Health Score | Analytics",
  description: "View your sprint health score and metrics",
};

export default async function HealthScorePage(props: HealthScorePageProps) {
  const params = await props.params;
  const workspaceId = params.workspaceId;
  const supabase = await createServerSupabaseClient();

  // Get current user
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">
            Please sign in to view health score analytics.
          </p>
        </div>
      </div>
    );
  }

  // Get workspace data
  const { data: workspace } = await supabase
    .from("workspaces")
    .select(WORKSPACE_COLUMNS.CORE)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single();

  // Get all statuses for the workspace
  const { data: statuses = [] } = workspace?.id
    ? await supabase
        .from("statuses")
        .select("id, name, color, status_type:status_types(name)")
        .eq("workspace_id", workspace.id)
    : { data: [] };

  // Build a map of status_id to status_type for O(1) lookup
  const statusTypeMap = new Map<string, string>();
  (statuses || []).forEach((status) => {
    if (status.status_type) {
      const statusTypeObj = Array.isArray(status.status_type)
        ? status.status_type[0]
        : status.status_type;
      const typeName = (statusTypeObj as any)?.name;
      if (typeName) {
        statusTypeMap.set(status.id, typeName);
      }
    }
  });

  // Fetch all tasks with status_id in a SINGLE query (instead of 6 separate count queries)
  const { data: tasks = [] } = workspace?.id
    ? await supabase
        .from("tasks")
        .select("id, status_id")
        .eq("workspace_id", workspace.id)
        .is("deleted_at", null)
    : { data: [] };

  // Count tasks by status type using the pre-built map - O(n) instead of O(n * status_types)
  const countsByType: Record<string, number> = {
    [STATUS_TYPES.NOT_STARTED]: 0,
    [STATUS_TYPES.ACTIVE]: 0,
    [STATUS_TYPES.DONE]: 0,
  };

  (tasks || []).forEach((task) => {
    const statusType = statusTypeMap.get(task.status_id);
    if (statusType && statusType in countsByType) {
      countsByType[statusType]++;
    }
  });

  // Build status type counts for display
  const statusTypeCounts = Object.entries(STATUS_TYPES).map(([key, statusTypeName]) => {
    const displayName =
      key === "NOT_STARTED"
        ? "Not Started"
        : key === "ACTIVE"
        ? "Active"
        : key === "DONE"
        ? "Done"
        : key;

    return {
      name: displayName,
      color: getStatusTypeColor(statusTypeName),
      count: countsByType[statusTypeName] || 0,
    };
  });

  // Calculate metrics directly from the counts (no additional queries needed)
  const totalTasks = (tasks || []).length;
  const completedCount = countsByType[STATUS_TYPES.DONE] || 0;
  const activeCount = countsByType[STATUS_TYPES.ACTIVE];
  const healthScore = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  // Determine health status
  const getHealthStatus = (score: number) => {
    if (score >= 80)
      return { label: "Excellent", color: "text-emerald-600", bgColor: "bg-emerald-100" };
    if (score >= 60)
      return { label: "Good", color: "text-blue-600", bgColor: "bg-blue-100" };
    if (score >= 40)
      return { label: "Needs Attention", color: "text-amber-600", bgColor: "bg-amber-100" };
    return { label: "Critical", color: "text-red-600", bgColor: "bg-red-100" };
  };

  const healthStatus = getHealthStatus(healthScore);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="px-4 py-6">
        {/* Breadcrumb */}
        <AnalyticsBreadcrumb workspaceId={workspaceId} currentPage="Health Score" />

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href={`/${workspaceId}/analytics`}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Heart className="w-7 h-7 text-rose-500" />
              Health Score
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Overall sprint health and completion metrics
            </p>
          </div>
        </div>

        {/* Main Health Score Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 mb-6 shadow-lg">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-xl">
                    <span className="text-4xl font-bold text-white">
                      {healthScore}%
                    </span>
                  </div>
                  <div className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 px-3 py-1 ${healthStatus.bgColor} rounded-full`}>
                    <span className={`text-sm font-medium ${healthStatus.color}`}>
                      {healthStatus.label}
                    </span>
                  </div>
                </div>
                <div className="hidden md:block ml-6">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Sprint Health Overview
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 max-w-md">
                    Your health score is calculated based on task completion rate,
                    active work in progress, and overall sprint progress.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    Completed
                  </span>
                </div>
                <span className="text-2xl font-bold text-emerald-600">
                  {completedCount}
                </span>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                    In Progress
                  </span>
                </div>
                <span className="text-2xl font-bold text-blue-600">
                  {activeCount}
                </span>
              </div>
            </div>
          </div>
          {totalTasks === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-4 text-center">
              Health score will appear once tasks have been created and moved through statuses
            </p>
          )}
        </div>

        {/* Status Distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-lg">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
            Task Distribution by Status
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statusTypeCounts.map((status) => (
              <div
                key={status.name}
                className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: status.color }}
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {status.name}
                  </span>
                </div>
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {status.count}
                </span>
                {totalTasks > 0 && (
                  <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                    ({Math.round((status.count / totalTasks) * 100)}%)
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Progress bar */}
          {totalTasks > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Overall Progress
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {completedCount} / {totalTasks} tasks
                </span>
              </div>
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-pink-600 rounded-full transition-all duration-500"
                  style={{ width: `${healthScore}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
