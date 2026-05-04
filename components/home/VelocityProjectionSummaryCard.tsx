"use client";

import Link from "next/link";
import { TrendingUp, ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { PredictiveVelocityData } from "@/hooks/useAdvancedAnalytics";

interface VelocityProjectionSummaryCardProps {
  workspaceId: string;
  data?: PredictiveVelocityData;
  isLoading?: boolean;
}

export function VelocityProjectionSummaryCard({
  workspaceId,
  data,
  isLoading,
}: VelocityProjectionSummaryCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-md">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2" />
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex gap-4">
          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const avgVelocity = data?.averageVelocity ?? null;
  const confidence = data?.confidenceLevel ?? null;
  const trend = data?.predictedTrend ?? null;

  const TrendIcon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-500"
      : trend === "down"
      ? "text-red-500"
      : "text-slate-400";

  return (
    <Link
      href={`/${workspaceId}/analytics/advanced?tab=predictions`}
      className="group"
    >
      <div className="relative bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-[1.01] shadow-md">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-md">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {avgVelocity !== null ? `${Math.round(avgVelocity)} pts` : "\u2014"}
            </span>
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-base group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            Velocity Projection
          </h3>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {confidence !== null ? `${confidence}% confidence` : "No data"}
            </p>
            {trend && (
              <span className={`flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
                <TrendIcon className="w-3 h-3" />
                {trend === "up" ? "Up" : trend === "down" ? "Down" : "Flat"}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
