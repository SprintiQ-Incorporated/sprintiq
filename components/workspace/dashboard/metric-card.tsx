"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  icon: React.ReactNode | string;
  label: string;
  value: string | number;
  color?: "green" | "blue" | "purple" | "orange" | "amber";
  className?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function MetricCard({
  icon,
  label,
  value,
  color = "green",
  className,
  trend,
}: MetricCardProps) {
  return (
    <Card className={cn("metric-card", className)}>
      <CardContent className="p-6">
        <div className={cn("metric-icon", color)}>
          {typeof icon === "string" ? (
            <span className="text-2xl">{icon}</span>
          ) : (
            icon
          )}
        </div>
        <div className="metric-value">{value}</div>
        <div className="metric-label">{label}</div>
        {trend && (
          <div
            className={cn(
              "text-xs font-medium mt-2",
              trend.isPositive ? "text-green-600" : "text-red-600"
            )}
          >
            {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}
