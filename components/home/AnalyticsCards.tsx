"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { usePredictiveVelocity, useDependencyGraph, useDeathSpiral } from "@/hooks/useAdvancedAnalytics";
import { VelocityProjectionSummaryCard } from "./VelocityProjectionSummaryCard";
import { DependenciesSummaryCard } from "./DependenciesSummaryCard";
import { DeathSpiralSummaryCard } from "./DeathSpiralSummaryCard";

interface AnalyticsCardsProps {
  workspaceId: string;
}

export function AnalyticsCards({ workspaceId }: AnalyticsCardsProps) {
  const predictiveQuery = usePredictiveVelocity(workspaceId);
  const depQuery = useDependencyGraph(workspaceId);
  const deathSpiralQuery = useDeathSpiral(workspaceId);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">
            Analytics
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track your project velocity, dependencies, and risk
          </p>
        </div>
        <Link
          href={`/${workspaceId}/analytics`}
          className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors"
        >
          View Full Dashboard
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Velocity Projection, Dependencies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <VelocityProjectionSummaryCard
          workspaceId={workspaceId}
          data={predictiveQuery.data}
          isLoading={predictiveQuery.isLoading}
        />
        <DependenciesSummaryCard
          workspaceId={workspaceId}
          data={depQuery.data}
          isLoading={depQuery.isLoading}
        />
      </div>

      {/* Death Spiral */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DeathSpiralSummaryCard
          workspaceId={workspaceId}
          data={deathSpiralQuery.data}
          isLoading={deathSpiralQuery.isLoading}
        />
      </div>
    </div>
  );
}
