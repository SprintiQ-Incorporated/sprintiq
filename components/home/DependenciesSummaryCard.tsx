"use client";

import Link from "next/link";
import { GitBranch } from "lucide-react";
import type { DependencyGraphData } from "@/hooks/useAdvancedAnalytics";

interface DependenciesSummaryCardProps {
  workspaceId: string;
  data?: DependencyGraphData;
  isLoading?: boolean;
}

export function DependenciesSummaryCard({
  workspaceId,
  data,
  isLoading,
}: DependenciesSummaryCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-md">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-3 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
      </div>
    );
  }

  const blockers = data?.metrics?.blockedStories ?? null;
  const atRisk =
    data?.bottlenecks?.filter(
      (b) => b.severity === "critical" || b.severity === "high"
    ).length ?? null;
  const hasData = blockers !== null;
  const noBlockers = hasData && blockers === 0 && (atRisk === 0 || atRisk === null);

  return (
    <Link
      href={`/${workspaceId}/analytics/advanced?tab=dependencies`}
      className="group"
    >
      <div className="relative bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-600 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-[1.01] shadow-md">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-md">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {hasData ? blockers : "\u2014"}
            </span>
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-base group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
            Dependencies
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            {noBlockers
              ? "No blockers detected"
              : hasData
              ? `${atRisk} at-risk dependencies`
              : "No data"}
          </p>
        </div>
      </div>
    </Link>
  );
}
