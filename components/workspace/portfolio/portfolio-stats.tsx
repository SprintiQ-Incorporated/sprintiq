"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortfolioStat {
  label: string;
  value: number;
  total?: number;
  change?: number;
  trend?: "up" | "down" | "neutral";
  unit?: string;
}

interface PortfolioStatsProps {
  stats?: PortfolioStat[];
  className?: string;
}

const defaultStats: PortfolioStat[] = [
  {
    label: "Total Projects",
    value: 12,
    change: 2,
    trend: "up",
  },
  {
    label: "Active Sprints",
    value: 3,
    total: 12,
    change: 0,
    trend: "neutral",
  },
  {
    label: "Completion Rate",
    value: 87,
    unit: "%",
    change: 5,
    trend: "up",
  },
  {
    label: "Team Velocity",
    value: 42,
    unit: "pts",
    change: -3,
    trend: "down",
  },
];

export function PortfolioStats({
  stats = defaultStats,
  className,
}: PortfolioStatsProps) {
  const getTrendIcon = (trend?: "up" | "down" | "neutral") => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case "down":
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case "neutral":
        return <Minus className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getTrendColor = (trend?: "up" | "down" | "neutral") => {
    switch (trend) {
      case "up":
        return "text-green-600";
      case "down":
        return "text-red-600";
      case "neutral":
        return "text-gray-500";
      default:
        return "text-gray-500";
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Portfolio Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stats.map((stat, index) => (
            <div key={index} className="stat-item">
              <div className="flex items-center justify-between mb-1">
                <span className="label text-sm text-gray-600">
                  {stat.label}
                </span>
                <div className="flex items-center gap-2">
                  <span className="value text-base font-semibold text-gray-900">
                    {stat.value}
                    {stat.unit}
                    {stat.total && (
                      <span className="text-sm text-gray-500 font-normal">
                        {" "}
                        / {stat.total}
                      </span>
                    )}
                  </span>
                  {stat.change !== undefined && stat.trend && (
                    <div className="flex items-center gap-1">
                      {getTrendIcon(stat.trend)}
                      <span
                        className={cn(
                          "text-xs font-medium",
                          getTrendColor(stat.trend)
                        )}
                      >
                        {stat.change > 0 ? "+" : ""}
                        {stat.change}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {stat.total && (
                <Progress
                  value={(stat.value / stat.total) * 100}
                  className="h-2"
                />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
