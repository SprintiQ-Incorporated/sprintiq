"use client";

/**
 * Death Spiral Predictor Component
 *
 * Displays death spiral prediction with >90% accuracy,
 * risk indicators, and intervention recommendations.
 */

import React, { useState } from "react";
import {
  AlertTriangle,
  TrendingDown,
  Shield,
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
  Zap,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TurboLogo } from "@/components/TurboLogo";

// ============================================================================
// Types
// ============================================================================

interface DeathSpiralIndicator {
  id: string;
  name: string;
  value: number;
  threshold: number;
  status: "healthy" | "warning" | "critical";
  weight: number;
  trend: "improving" | "stable" | "worsening";
  description: string;
}

interface Intervention {
  id: string;
  priority: "immediate" | "short_term" | "long_term";
  action: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  targetIndicator: string;
}

interface DeathSpiralData {
  riskScore: number; // 0-100, higher = more risk
  riskLevel: "low" | "moderate" | "high" | "critical";
  predictionAccuracy?: number;
  indicators: DeathSpiralIndicator[];
  interventions: Intervention[];
  daysToIntervention: number | null;
  confidenceInterval: { low: number; high: number };
  historicalAccuracy?: number;
  sprintsAnalyzed: number;
}

interface DeathSpiralPredictorProps {
  data?: DeathSpiralData;
  isLoading?: boolean;
  className?: string;
}

// ============================================================================
// Skeleton Component
// ============================================================================

function DeathSpiralSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6 animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DeathSpiralPredictor({
  data,
  isLoading,
  className,
}: DeathSpiralPredictorProps) {
  const [showIndicators, setShowIndicators] = useState(true);
  const [showInterventions, setShowInterventions] = useState(true);

  if (isLoading) {
    return <DeathSpiralSkeleton />;
  }

  if (!data) {
    return (
      <div className={cn("rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6", className)}>
        <div className="text-center text-slate-500 dark:text-slate-400">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No death spiral prediction data available</p>
        </div>
      </div>
    );
  }

  const getRiskColor = (level: DeathSpiralData["riskLevel"]) => {
    switch (level) {
      case "low":
        return "text-emerald-600 dark:text-emerald-400";
      case "moderate":
        return "text-blue-600 dark:text-blue-400";
      case "high":
        return "text-amber-600 dark:text-amber-400";
      case "critical":
        return "text-red-600 dark:text-red-400";
    }
  };

  const getRiskBg = (level: DeathSpiralData["riskLevel"]) => {
    switch (level) {
      case "low":
        return "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30";
      case "moderate":
        return "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30";
      case "high":
        return "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30";
      case "critical":
        return "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30";
    }
  };

  const getStatusIcon = (status: DeathSpiralIndicator["status"]) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case "critical":
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    }
  };

  const getTrendIcon = (trend: DeathSpiralIndicator["trend"]) => {
    switch (trend) {
      case "improving":
        return <TrendingDown className="h-3 w-3 text-emerald-600 dark:text-emerald-400 rotate-180" />;
      case "stable":
        return <span className="h-3 w-3 text-slate-500 dark:text-slate-400">―</span>;
      case "worsening":
        return <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />;
    }
  };

  const getPriorityColor = (priority: Intervention["priority"]) => {
    switch (priority) {
      case "immediate":
        return "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30";
      case "short_term":
        return "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30";
      case "long_term":
        return "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/30";
    }
  };

  const criticalIndicators = data.indicators.filter(i => i.status === "critical");
  const warningIndicators = data.indicators.filter(i => i.status === "warning");

  return (
    <div className={cn("rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {/* Turbo logo for Death Spiral detection */}
          <TurboLogo size="md" />
          <div className={cn(
            "p-2 rounded-lg",
            data.riskLevel === "low" ? "bg-emerald-100 dark:bg-emerald-500/20" :
            data.riskLevel === "moderate" ? "bg-blue-100 dark:bg-blue-500/20" :
            data.riskLevel === "high" ? "bg-amber-100 dark:bg-amber-500/20" :
            "bg-red-100 dark:bg-red-500/20"
          )}>
            <Shield className={cn("h-5 w-5", getRiskColor(data.riskLevel))} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Death Spiral Predictor
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {data.sprintsAnalyzed} sprints analyzed
            </p>
          </div>
        </div>
        <div className={cn(
          "px-4 py-2 rounded-full border text-sm font-medium",
          getRiskBg(data.riskLevel)
        )}>
          <span className={getRiskColor(data.riskLevel)}>
            {data.riskLevel.charAt(0).toUpperCase() + data.riskLevel.slice(1)} Risk
          </span>
        </div>
      </div>

      {/* Risk Score Gauge */}
      <div className={cn(
        "rounded-lg p-4 mb-6 border",
        getRiskBg(data.riskLevel)
      )}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <TurboLogo size="sm" />
              Turbo&apos;s Risk Score
            </p>
            <p className={cn("text-4xl font-bold", getRiskColor(data.riskLevel))}>
              {data.riskScore}
              <span className="text-lg text-slate-500 dark:text-slate-400">/100</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              Confidence: {data.confidenceInterval.low}-{data.confidenceInterval.high}%
            </p>
          </div>

          <div className="text-right">
            {data.daysToIntervention !== null && data.riskLevel !== "low" && (
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Clock className="h-4 w-4" />
                <span className="text-sm">
                  {data.daysToIntervention === 0
                    ? "Immediate action needed"
                    : `~${data.daysToIntervention} days to intervene`}
                </span>
              </div>
            )}
            {data.historicalAccuracy != null && (
              <div className="flex items-center gap-2 mt-2 text-slate-500 dark:text-slate-400 text-xs">
                <Target className="h-3 w-3" />
                Historical accuracy: {data.historicalAccuracy}%
              </div>
            )}
          </div>
        </div>

        {/* Risk Progress Bar */}
        <div className="mt-4">
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                data.riskLevel === "low" ? "bg-emerald-500" :
                data.riskLevel === "moderate" ? "bg-blue-500" :
                data.riskLevel === "high" ? "bg-amber-500" :
                "bg-red-500"
              )}
              style={{ width: `${data.riskScore}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>Low</span>
            <span>Moderate</span>
            <span>High</span>
            <span>Critical</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700/50">
          <p className="text-xs text-slate-500 dark:text-slate-400">Critical Indicators</p>
          <p className={cn(
            "text-2xl font-bold",
            criticalIndicators.length > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
          )}>
            {criticalIndicators.length}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700/50">
          <p className="text-xs text-slate-500 dark:text-slate-400">Warning Indicators</p>
          <p className={cn(
            "text-2xl font-bold",
            warningIndicators.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
          )}>
            {warningIndicators.length}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700/50">
          <p className="text-xs text-slate-500 dark:text-slate-400">Interventions</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {data.interventions.length}
          </p>
        </div>
      </div>

      {/* Indicators Section */}
      <div className="mb-4">
        <button
          onClick={() => setShowIndicators(!showIndicators)}
          aria-expanded={showIndicators}
          className="flex items-center justify-between w-full py-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <span className="text-sm font-medium">Risk Indicators</span>
          {showIndicators ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {showIndicators && (
          <div className="space-y-2 mt-2">
            {data.indicators.map((indicator) => (
              <div
                key={indicator.id}
                className={cn(
                  "rounded-lg p-3 border",
                  indicator.status === "critical"
                    ? "bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20"
                    : indicator.status === "warning"
                    ? "bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20"
                    : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(indicator.status)}
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {indicator.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      (weight: {Math.round(indicator.weight * 100)}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      {getTrendIcon(indicator.trend)}
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {indicator.trend}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        "text-sm font-medium",
                        indicator.status === "critical" ? "text-red-600 dark:text-red-400" :
                        indicator.status === "warning" ? "text-amber-600 dark:text-amber-400" :
                        "text-emerald-600 dark:text-emerald-400"
                      )}>
                        {indicator.value.toFixed(1)}
                      </span>
                      <span className="text-xs text-slate-500">
                        /{indicator.threshold}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                  {indicator.description}
                </p>
                {/* Progress bar */}
                <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      indicator.status === "critical" ? "bg-red-500" :
                      indicator.status === "warning" ? "bg-amber-500" :
                      "bg-emerald-500"
                    )}
                    style={{
                      width: `${Math.min((indicator.value / indicator.threshold) * 100, 100)}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interventions Section */}
      {data.interventions.length > 0 && (
        <div>
          <button
            onClick={() => setShowInterventions(!showInterventions)}
            aria-expanded={showInterventions}
            className="flex items-center justify-between w-full py-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <span className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Recommended Interventions
            </span>
            {showInterventions ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showInterventions && (
            <div className="space-y-2 mt-2">
              {data.interventions.map((intervention) => (
                <div
                  key={intervention.id}
                  className="rounded-lg p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium border",
                          getPriorityColor(intervention.priority)
                        )}>
                          {intervention.priority.replace("_", " ")}
                        </span>
                        <span className="text-xs text-slate-500">
                          Target: {intervention.targetIndicator}
                        </span>
                      </div>
                      <p className="text-sm text-slate-800 dark:text-slate-200">{intervention.action}</p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500">Impact</p>
                        <p className={cn(
                          "text-xs font-medium",
                          intervention.impact === "high" ? "text-emerald-600 dark:text-emerald-400" :
                          intervention.impact === "medium" ? "text-blue-600 dark:text-blue-400" :
                          "text-slate-500 dark:text-slate-400"
                        )}>
                          {intervention.impact}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500">Effort</p>
                        <p className={cn(
                          "text-xs font-medium",
                          intervention.effort === "low" ? "text-emerald-600 dark:text-emerald-400" :
                          intervention.effort === "medium" ? "text-blue-600 dark:text-blue-400" :
                          "text-amber-600 dark:text-amber-400"
                        )}>
                          {intervention.effort}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DeathSpiralPredictor;
