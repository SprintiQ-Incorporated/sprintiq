"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalyticsMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
    isPositive?: boolean;
  };
  icon?: React.ReactNode;
  color?: "blue" | "green" | "purple" | "orange" | "red" | "gray";
  className?: string;
}

const colorStyles = {
  blue: {
    bg: "bg-blue-50",
    icon: "bg-blue-100 text-blue-600",
    text: "text-blue-600",
  },
  green: {
    bg: "bg-green-50",
    icon: "bg-green-100 text-green-600",
    text: "text-green-600",
  },
  purple: {
    bg: "bg-purple-50",
    icon: "bg-purple-100 text-purple-600",
    text: "text-purple-600",
  },
  orange: {
    bg: "bg-orange-50",
    icon: "bg-orange-100 text-orange-600",
    text: "text-orange-600",
  },
  red: {
    bg: "bg-red-50",
    icon: "bg-red-100 text-red-600",
    text: "text-red-600",
  },
  gray: {
    bg: "bg-gray-50",
    icon: "bg-gray-100 text-gray-600",
    text: "text-gray-600",
  },
};

export function AnalyticsMetricCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = "blue",
  className,
}: AnalyticsMetricCardProps) {
  const styles = colorStyles[color];

  const getTrendIcon = () => {
    if (!trend) return null;

    const isPositiveTrend =
      trend.isPositive !== undefined
        ? trend.isPositive
        : trend.direction === "up";

    const iconColor = isPositiveTrend
      ? "text-green-600"
      : trend.direction === "neutral"
      ? "text-gray-400"
      : "text-red-600";

    if (trend.direction === "up") {
      return <TrendingUp className={cn("w-4 h-4", iconColor)} />;
    } else if (trend.direction === "down") {
      return <TrendingDown className={cn("w-4 h-4", iconColor)} />;
    } else {
      return <Minus className={cn("w-4 h-4", iconColor)} />;
    }
  };

  return (
    <Card className={cn("overflow-hidden @container", className)}>
      <CardContent className="p-4 @sm:p-6">
        <div className="flex flex-col @xs:flex-row @xs:items-start @xs:justify-between gap-3 @xs:gap-0">
          <div className="flex-1 order-2 @xs:order-1">
            <p className="text-xs @sm:text-sm font-medium text-gray-600 mb-1 @sm:mb-2">{title}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl @sm:text-3xl font-bold text-gray-900">{value}</h3>
              {trend && (
                <div className="flex items-center gap-1">
                  {getTrendIcon()}
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      trend.isPositive !== undefined
                        ? trend.isPositive
                          ? "text-green-600"
                          : "text-red-600"
                        : trend.direction === "up"
                        ? "text-green-600"
                        : trend.direction === "down"
                        ? "text-red-600"
                        : "text-gray-400"
                    )}
                  >
                    {trend.value > 0 ? "+" : ""}
                    {trend.value}%
                  </span>
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div className={cn("p-2 @sm:p-3 rounded-lg order-1 @xs:order-2", styles.icon)}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
