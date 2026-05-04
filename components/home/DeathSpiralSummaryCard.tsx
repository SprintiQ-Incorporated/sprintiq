"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { DeathSpiralData } from "@/hooks/useAdvancedAnalytics";

interface DeathSpiralSummaryCardProps {
  workspaceId: string;
  data?: DeathSpiralData;
  isLoading?: boolean;
}

export function DeathSpiralSummaryCard({
  workspaceId,
  data,
  isLoading,
}: DeathSpiralSummaryCardProps) {
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

  const riskScore = data?.riskScore ?? null;
  const riskLevel = data?.riskLevel ?? null;
  const criticalCount =
    data?.indicators?.filter(
      (i) => i.status === "critical" || i.status === "warning"
    ).length ?? null;

  const riskLabelColor =
    riskLevel === "critical"
      ? "text-red-500"
      : riskLevel === "high"
      ? "text-orange-500"
      : riskLevel === "moderate"
      ? "text-amber-500"
      : "text-emerald-500";

  const riskLabel =
    riskLevel === "critical"
      ? "Critical"
      : riskLevel === "high"
      ? "High"
      : riskLevel === "moderate"
      ? "Moderate"
      : "Low";

  return (
    <Link
      href={`/${workspaceId}/analytics/advanced?tab=death-spiral`}
      className="group"
    >
      <div className="relative bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-600 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-[1.01] shadow-md">
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-amber-50 dark:from-red-900/20 dark:to-amber-900/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-amber-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-md">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {riskScore !== null ? `${riskScore}` : "\u2014"}
            </span>
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-base group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
            Death Spiral Risk
          </h3>
          <div className="flex items-center gap-3 mt-1">
            {riskLevel ? (
              <span className={`text-xs font-medium ${riskLabelColor}`}>
                {riskLabel}
              </span>
            ) : (
              <span className="text-xs text-slate-400">No data</span>
            )}
            {criticalCount !== null && criticalCount > 0 && (
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {criticalCount} indicator{criticalCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
