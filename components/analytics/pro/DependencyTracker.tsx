"use client";

/**
 * Dependency Tracker Component
 *
 * Fetches real dependency data from the API and displays:
 * - Dependency Tracker: lists blocking dependencies with status and owner info
 * - Dependency Impact Analysis: total blocked tasks, sprint impact, resolution estimate
 *
 * Uses the same API endpoint as the DependencyGraph component
 * (/api/workspace/[workspaceId]/analytics/advanced/dependencies)
 * but presents the data in a simpler tracker/summary format.
 */

import { useDependencyGraph } from "@/hooks/useAdvancedAnalytics";
import {
  Zap,
  AlertTriangle,
  CheckCircle,
  GitBranch,
  Loader2,
} from "lucide-react";

interface DependencyTrackerProps {
  workspaceId: string;
}

export function DependencyTracker({ workspaceId }: DependencyTrackerProps) {
  const { data, isLoading, error } = useDependencyGraph(workspaceId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-lg">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
              Loading dependency data...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-lg">
          <div className="text-center py-12">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Failed to load dependency data
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-lg">
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No dependency data available</p>
            <p className="text-xs mt-1">
              Dependencies will appear here when tasks have blocking relationships
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Build dependency tracker items from nodes that have dependents (they block other tasks)
  const blockingNodes = data.nodes.filter(
    (node) => node.dependents.length > 0
  );

  // Categorize: "at_risk" = not done, "resolved" = done
  const trackerItems = blockingNodes.map((node) => {
    const isResolved = node.status === "done";
    return {
      id: node.id,
      name: node.title,
      status: isResolved ? ("resolved" as const) : ("at_risk" as const),
      blockedTasks: node.dependents.length,
      sprintName: node.sprintName || undefined,
    };
  });

  // Sort: at-risk first (by blocked count desc), then resolved
  trackerItems.sort((a, b) => {
    if (a.status !== b.status) return a.status === "at_risk" ? -1 : 1;
    return b.blockedTasks - a.blockedTasks;
  });

  const atRiskCount = trackerItems.filter(
    (d) => d.status === "at_risk"
  ).length;
  const resolvedCount = trackerItems.filter(
    (d) => d.status === "resolved"
  ).length;

  // Impact analysis metrics
  const totalBlockedTasks = data.metrics.blockedStories;
  const activeNodes = data.nodes.filter((n) => n.status !== "done");
  const blockedPercentage =
    activeNodes.length > 0
      ? Math.round((totalBlockedTasks / activeNodes.length) * 100)
      : 0;

  const sprintImpact =
    blockedPercentage >= 30
      ? "High"
      : blockedPercentage >= 10
        ? "Medium"
        : "Low";
  const sprintImpactColor =
    sprintImpact === "High"
      ? "text-red-600"
      : sprintImpact === "Medium"
        ? "text-orange-600"
        : "text-emerald-600";

  return (
    <div className="space-y-6">
      {/* Dependency Tracker */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-500" />
            Dependency Tracker
          </h3>
          <div className="flex items-center gap-2">
            {atRiskCount > 0 && (
              <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400 text-sm font-medium rounded-full">
                {atRiskCount} at risk
              </span>
            )}
            {resolvedCount > 0 && (
              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-sm font-medium rounded-full">
                {resolvedCount} resolved
              </span>
            )}
          </div>
        </div>

        {trackerItems.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <p className="text-sm">
              No blocking dependencies found in current tasks
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {trackerItems.map((dep) => (
              <div
                key={dep.id}
                className={`p-4 rounded-xl flex items-center justify-between ${
                  dep.status === "at_risk"
                    ? "bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800"
                    : "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      dep.status === "at_risk"
                        ? "bg-orange-100 dark:bg-orange-800"
                        : "bg-emerald-100 dark:bg-emerald-800"
                    }`}
                  >
                    {dep.status === "at_risk" ? (
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-white">
                      {dep.name}
                    </h4>
                    {dep.sprintName && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Sprint: {dep.sprintName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {dep.status === "at_risk" ? (
                    <>
                      <p className="text-lg font-bold text-orange-600">
                        {dep.blockedTasks}
                      </p>
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        blocked tasks
                      </p>
                    </>
                  ) : (
                    <span className="px-3 py-1 bg-emerald-200 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-medium rounded-full">
                      Resolved
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dependency Impact Analysis */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-lg">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
          Dependency Impact Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              Total Blocked Tasks
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {totalBlockedTasks}
            </p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              Sprint Impact
            </p>
            <p className={`text-2xl font-bold ${sprintImpactColor}`}>
              {sprintImpact}
            </p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              Critical Path Length
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {data.metrics.criticalPathLength}{" "}
              {data.metrics.criticalPathLength === 1 ? "task" : "tasks"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DependencyTracker;
