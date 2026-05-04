"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type PriorityLevel = "critical" | "high" | "medium" | "low" | null;

interface PriorityBadgeProps {
  priority: PriorityLevel | string | null;
  aiApplied?: boolean;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

const priorityConfig: Record<
  string,
  {
    label: string;
    bgColor: string;
    textColor: string;
    dotColor: string;
  }
> = {
  critical: {
    label: "Critical",
    bgColor: "bg-red-100 dark:bg-red-950",
    textColor: "text-red-700 dark:text-red-300",
    dotColor: "bg-red-500",
  },
  high: {
    label: "High",
    bgColor: "bg-orange-100 dark:bg-orange-950",
    textColor: "text-orange-700 dark:text-orange-300",
    dotColor: "bg-orange-500",
  },
  medium: {
    label: "Medium",
    bgColor: "bg-blue-100 dark:bg-blue-950",
    textColor: "text-blue-700 dark:text-blue-300",
    dotColor: "bg-blue-500",
  },
  low: {
    label: "Low",
    bgColor: "bg-green-100 dark:bg-green-950",
    textColor: "text-green-700 dark:text-green-300",
    dotColor: "bg-green-500",
  },
  none: {
    label: "None",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    textColor: "text-gray-500 dark:text-gray-400",
    dotColor: "bg-gray-400",
  },
};

/**
 * Shared PriorityBadge component that displays priority level with optional AI indicator
 */
export function PriorityBadge({
  priority,
  aiApplied = false,
  size = "sm",
  showLabel = true,
  className,
}: PriorityBadgeProps) {
  // Normalize priority to lowercase
  const normalizedPriority = priority?.toLowerCase() || "none";
  const config = priorityConfig[normalizedPriority] || priorityConfig.none;

  const sizeClasses = {
    sm: {
      container: "px-2 py-0.5 text-xs",
      dot: "w-1.5 h-1.5",
      sparkles: 10,
    },
    md: {
      container: "px-2.5 py-1 text-sm",
      dot: "w-2 h-2",
      sparkles: 12,
    },
  };

  const sizes = sizeClasses[size];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium transition-colors",
        config.bgColor,
        config.textColor,
        sizes.container,
        className
      )}
    >
      <span className={cn("rounded-full flex-shrink-0", config.dotColor, sizes.dot)} />
      {showLabel && <span>{config.label}</span>}
      {aiApplied && (
        <Sparkles
          size={sizes.sparkles}
          className="text-amber-500 dark:text-amber-400 flex-shrink-0"
          aria-label="AI Priority Applied"
        />
      )}
    </span>
  );
}

export default PriorityBadge;
