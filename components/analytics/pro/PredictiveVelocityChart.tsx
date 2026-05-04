"use client";

/**
 * Predictive Velocity Chart Component
 *
 * Displays 3-sprint forward velocity projections with
 * confidence intervals and risk factors.
 */

import React from "react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
  Legend,
} from "recharts";
import { TrendingUp, Target, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface VelocityDataPoint {
  sprint: string;
  actual?: number;
  predicted?: number;
  confidenceLow?: number;
  confidenceHigh?: number;
  isPrediction: boolean;
}

interface RiskFactor {
  id: string;
  name: string;
  impact: "high" | "medium" | "low";
  description: string;
}

interface PredictiveVelocityData {
  dataPoints: VelocityDataPoint[];
  averageVelocity: number;
  predictedTrend: "up" | "down" | "stable";
  trendPercentage: number;
  predictionAccuracy: number;
  confidenceLevel: number;
  riskFactors: RiskFactor[];
  recommendations: string[];
}

interface PredictiveVelocityChartProps {
  data?: PredictiveVelocityData;
  isLoading?: boolean;
  className?: string;
}

// ============================================================================
// Custom Tooltip
// ============================================================================

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const dataPoint = payload[0]?.payload as VelocityDataPoint;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-xl">
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">{label}</p>
      {dataPoint.actual !== undefined && (
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-slate-500 dark:text-slate-400">Actual:</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{dataPoint.actual} pts</span>
        </div>
      )}
      {dataPoint.predicted !== undefined && (
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-slate-500 dark:text-slate-400">Predicted:</span>
          <span className="text-blue-600 dark:text-blue-400 font-medium">{dataPoint.predicted} pts</span>
        </div>
      )}
      {dataPoint.isPrediction && dataPoint.confidenceLow !== undefined && (
        <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
          Range: {dataPoint.confidenceLow} - {dataPoint.confidenceHigh} pts
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Skeleton Component
// ============================================================================

function PredictiveVelocitySkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6 animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
      <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-lg mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PredictiveVelocityChart({
  data,
  isLoading,
  className,
}: PredictiveVelocityChartProps) {
  if (isLoading) {
    return <PredictiveVelocitySkeleton />;
  }

  if (!data) {
    return (
      <div className={cn("rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6", className)}>
        <div className="text-center text-slate-500 dark:text-slate-400">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No velocity prediction data available</p>
        </div>
      </div>
    );
  }

  const getTrendIcon = () => {
    if (data.predictedTrend === "up") {
      return <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    } else if (data.predictedTrend === "down") {
      return <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400 rotate-180" />;
    }
    return <span className="text-slate-500 dark:text-slate-400">→</span>;
  };

  const getTrendColor = () => {
    if (data.predictedTrend === "up") return "text-emerald-600 dark:text-emerald-400";
    if (data.predictedTrend === "down") return "text-red-600 dark:text-red-400";
    return "text-slate-500 dark:text-slate-400";
  };

  // Compute confidence range for proper stacked area rendering
  const chartData = data.dataPoints.map(dp => ({
    ...dp,
    confidenceRange:
      dp.confidenceHigh != null && dp.confidenceLow != null
        ? dp.confidenceHigh - dp.confidenceLow
        : undefined,
  }));

  return (
    <div className={cn("rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Velocity Projection
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              3-sprint forward prediction • {data.predictionAccuracy}% accuracy
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getTrendIcon()}
          <span className={cn("text-sm font-medium", getTrendColor())}>
            {data.predictedTrend === "stable"
              ? "Stable"
              : `${data.trendPercentage > 0 ? "+" : ""}${data.trendPercentage}%`}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="sprint"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={{ stroke: "#475569" }}
              tickLine={{ stroke: "#475569" }}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={{ stroke: "#475569" }}
              tickLine={{ stroke: "#475569" }}
              domain={["auto", "auto"]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: "10px" }}
              formatter={(value) => (
                <span className="text-slate-400 text-xs">{value}</span>
              )}
            />

            {/* Confidence interval band: invisible base (low) + visible range (high - low) */}
            <Area
              type="monotone"
              dataKey="confidenceLow"
              stackId="confidence"
              stroke="none"
              fill="transparent"
              legendType="none"
            />
            <Area
              type="monotone"
              dataKey="confidenceRange"
              stackId="confidence"
              stroke="none"
              fill="#3b82f6"
              fillOpacity={0.15}
              name="Confidence Range"
            />

            {/* Reference line for average */}
            <ReferenceLine
              y={data.averageVelocity}
              stroke="#6366f1"
              strokeDasharray="5 5"
              label={{
                value: `Avg: ${data.averageVelocity}`,
                fill: "#94a3b8",
                fontSize: 10,
                position: "right",
              }}
            />

            {/* Actual velocity line */}
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: "#10b981", strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: "#10b981" }}
              name="Actual Velocity"
              connectNulls={false}
            />

            {/* Predicted velocity line */}
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: "#3b82f6", strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: "#3b82f6" }}
              name="Predicted"
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Avg Velocity</span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {data.averageVelocity}
            <span className="text-sm text-slate-500 ml-1">pts</span>
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Confidence</span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {data.confidenceLevel}%
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Risk Factors</span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {data.riskFactors.length}
          </p>
        </div>
      </div>

      {/* Risk Factors */}
      {data.riskFactors.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Risk Factors</h4>
          <div className="space-y-2">
            {data.riskFactors.slice(0, 3).map((risk) => (
              <div
                key={risk.id}
                className={cn(
                  "rounded-lg p-2 border text-sm",
                  risk.impact === "high"
                    ? "bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20"
                    : risk.impact === "medium"
                    ? "bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20"
                    : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-800 dark:text-slate-200">{risk.name}</span>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded",
                    risk.impact === "high"
                      ? "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
                      : risk.impact === "medium"
                      ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                  )}>
                    {risk.impact} impact
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{risk.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Recommendations</h4>
          <ul className="space-y-1">
            {data.recommendations.slice(0, 3).map((rec, index) => (
              <li key={index} className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
                <span className="text-emerald-600 dark:text-emerald-400 mt-0.5">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default PredictiveVelocityChart;
