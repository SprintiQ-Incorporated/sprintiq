"use client";

import React, { useState } from "react";
import {
  DeathSpiralPredictor,
  PredictiveVelocityChart,
  DependencyGraph,
} from "@/components/analytics/pro";
import {
  useAllAdvancedAnalytics,
  useProfessionalHealthSummary,
} from "@/hooks/useAdvancedAnalytics";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCcw,
  Download,
  GitBranch,
  Sparkles,
  AlertTriangle,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalyticsDashboardProps {
  workspaceId: string;
  className?: string;
  initialTab?: string;
}

export function AnalyticsDashboard({
  workspaceId,
  className,
  initialTab = "overview",
}: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  const {
    deathSpiral,
    predictiveVelocity,
    dependencies,
    isLoading,
    isError,
    refetchAll,
  } = useAllAdvancedAnalytics(workspaceId);

  const healthSummary = useProfessionalHealthSummary(workspaceId);

  const handleExport = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      healthSummary,
      deathSpiral,
      predictiveVelocity,
      dependencies: {
        metrics: dependencies?.metrics,
        criticalPath: dependencies?.criticalPath,
        bottlenecks: dependencies?.bottlenecks,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sprintiq-analytics-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-emerald-600 dark:text-emerald-400";
      case "fair":
        return "text-blue-600 dark:text-blue-400";
      case "at_risk":
        return "text-amber-600 dark:text-amber-400";
      case "critical":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-slate-600 dark:text-slate-400";
    }
  };

  const getHealthBg = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30";
      case "fair":
        return "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30";
      case "at_risk":
        return "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30";
      case "critical":
        return "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30";
      default:
        return "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700";
    }
  };

  return (
    <div className={cn("", className)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
            Velocity Analytics
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Predictive forecasting, dependency analysis, and risk indicators from your live sprint data
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchAll()}
            className="border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCcw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Download className="h-4 w-4 mr-1" />
            Export Report
          </Button>
        </div>
      </div>

      {isError && !isLoading && (
        <div className="rounded-xl p-4 mb-6 border bg-red-500/10 border-red-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                  Some analytics failed to load
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Partial data may be shown. Click refresh to retry.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchAll()}
              className="border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <RefreshCcw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {healthSummary.overallScore !== null && (
        <div
          className={cn(
            "rounded-xl p-4 mb-6 border",
            getHealthBg(healthSummary.status)
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2 rounded-lg",
                  healthSummary.status === "healthy"
                    ? "bg-emerald-100 dark:bg-emerald-500/20"
                    : healthSummary.status === "fair"
                    ? "bg-blue-100 dark:bg-blue-500/20"
                    : healthSummary.status === "at_risk"
                    ? "bg-amber-100 dark:bg-amber-500/20"
                    : "bg-red-100 dark:bg-red-500/20"
                )}
              >
                <Sparkles className={cn("h-5 w-5", getHealthColor(healthSummary.status))} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                  Project Risk Score
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Aggregated from death spiral risk indicators
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p
                  className={cn(
                    "text-3xl font-bold",
                    getHealthColor(healthSummary.status)
                  )}
                >
                  {healthSummary.overallScore}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                  {healthSummary.status.replace("_", " ")}
                </p>
              </div>
              {healthSummary.criticalIssues > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {healthSummary.criticalIssues} critical issues
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-gray-50 dark:bg-gray-800/50 p-1 rounded-xl gap-1 flex-wrap">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Target className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger
            value="predictions"
            className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <TrendingUp className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Forecast</span>
          </TabsTrigger>
          <TabsTrigger
            value="dependencies"
            className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <GitBranch className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Dependencies</span>
          </TabsTrigger>
          <TabsTrigger
            value="death-spiral"
            className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <AlertTriangle className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Death Spiral</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PredictiveVelocityChart
              data={predictiveVelocity}
              isLoading={isLoading}
            />
            <DeathSpiralPredictor data={deathSpiral} isLoading={isLoading} />
          </div>

          <DependencyGraph data={dependencies} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          <PredictiveVelocityChart
            data={predictiveVelocity}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="dependencies" className="space-y-6">
          <DependencyGraph data={dependencies} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="death-spiral" className="space-y-6">
          <DeathSpiralPredictor data={deathSpiral} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AnalyticsDashboard;
