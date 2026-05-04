"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type IndicatorSize = "sm" | "md" | "lg";

export interface SkillMatchIndicatorProps {
  /** Skill match percentage (0-100) */
  matchPercentage: number;
  /** Size of the indicator */
  size?: IndicatorSize;
  /** Whether to show the percentage label */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const THRESHOLDS = {
  high: 70,
  medium: 40,
} as const;

const COLORS = {
  high: {
    bg: "bg-green-500",
    bgLight: "bg-green-100",
    text: "text-green-500",
    border: "border-green-500",
    hex: "#22c55e",
  },
  medium: {
    bg: "bg-yellow-500",
    bgLight: "bg-yellow-100",
    text: "text-yellow-500",
    border: "border-yellow-500",
    hex: "#eab308",
  },
  low: {
    bg: "bg-red-500",
    bgLight: "bg-red-100",
    text: "text-red-500",
    border: "border-red-500",
    hex: "#ef4444",
  },
} as const;

const SIZES = {
  sm: {
    circle: "h-5 w-5",
    icon: "h-3 w-3",
    bar: "h-1.5",
    barContainer: "w-16",
    text: "text-xs",
    gap: "gap-1",
  },
  md: {
    circle: "h-6 w-6",
    icon: "h-4 w-4",
    bar: "h-2",
    barContainer: "w-20",
    text: "text-sm",
    gap: "gap-1.5",
  },
  lg: {
    circle: "h-8 w-8",
    icon: "h-5 w-5",
    bar: "h-2.5",
    barContainer: "w-24",
    text: "text-base",
    gap: "gap-2",
  },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

type MatchLevel = "high" | "medium" | "low";

function getMatchLevel(percentage: number): MatchLevel {
  if (percentage >= THRESHOLDS.high) return "high";
  if (percentage >= THRESHOLDS.medium) return "medium";
  return "low";
}

function getColorConfig(percentage: number) {
  const level = getMatchLevel(percentage);
  return COLORS[level];
}

function getSizeConfig(size: IndicatorSize) {
  return SIZES[size];
}

// ============================================================================
// SkillMatchCircle Component
// ============================================================================

/**
 * Circular skill match indicator with icon
 *
 * @example
 * ```tsx
 * <SkillMatchCircle matchPercentage={85} />
 * <SkillMatchCircle matchPercentage={55} size="lg" showLabel />
 * <SkillMatchCircle matchPercentage={20} showLabel />
 * ```
 */
export function SkillMatchCircle({
  matchPercentage,
  size = "md",
  showLabel = false,
  className,
}: SkillMatchIndicatorProps) {
  const normalizedPercentage = Math.max(0, Math.min(100, Math.round(matchPercentage)));
  const colors = getColorConfig(normalizedPercentage);
  const sizes = getSizeConfig(size);
  const level = getMatchLevel(normalizedPercentage);

  const Icon =
    level === "high"
      ? CheckCircle2
      : level === "medium"
        ? AlertTriangle
        : XCircle;

  const ariaLabel = `Skill match: ${normalizedPercentage}%`;
  const tooltipText = `Skill match: ${normalizedPercentage}%`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center",
              sizes.gap,
              className
            )}
            role="img"
            aria-label={ariaLabel}
          >
            <div
              className={cn(
                "rounded-full flex items-center justify-center",
                colors.bgLight,
                sizes.circle
              )}
            >
              <Icon className={cn(sizes.icon, colors.text)} />
            </div>
            {showLabel && (
              <span className={cn(sizes.text, colors.text, "font-medium")}>
                {normalizedPercentage}% match
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// SkillMatchBar Component
// ============================================================================

/**
 * Horizontal bar skill match indicator
 *
 * @example
 * ```tsx
 * <SkillMatchBar matchPercentage={85} />
 * <SkillMatchBar matchPercentage={55} size="lg" showLabel />
 * <SkillMatchBar matchPercentage={20} showLabel />
 * ```
 */
export function SkillMatchBar({
  matchPercentage,
  size = "md",
  showLabel = false,
  className,
}: SkillMatchIndicatorProps) {
  const normalizedPercentage = Math.max(0, Math.min(100, Math.round(matchPercentage)));
  const colors = getColorConfig(normalizedPercentage);
  const sizes = getSizeConfig(size);
  const level = getMatchLevel(normalizedPercentage);

  const Icon =
    level === "high"
      ? CheckCircle2
      : level === "medium"
        ? AlertTriangle
        : XCircle;

  const ariaLabel = `Skill match: ${normalizedPercentage}%`;
  const tooltipText = `Skill match: ${normalizedPercentage}%`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center",
              sizes.gap,
              className
            )}
            role="img"
            aria-label={ariaLabel}
          >
            {/* Icon */}
            <Icon className={cn(sizes.icon, colors.text, "flex-shrink-0")} />

            {/* Bar Container */}
            <div
              className={cn(
                "rounded-full overflow-hidden bg-slate-200",
                sizes.bar,
                sizes.barContainer
              )}
            >
              {/* Progress Fill */}
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300 ease-out",
                  colors.bg
                )}
                style={{ width: `${normalizedPercentage}%` }}
              />
            </div>

            {/* Label */}
            {showLabel && (
              <span className={cn(sizes.text, colors.text, "font-medium")}>
                {normalizedPercentage}% match
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Combined Export (Default uses Circle)
// ============================================================================

/**
 * Default skill match indicator (uses circular variant)
 *
 * @example
 * ```tsx
 * <SkillMatchIndicator matchPercentage={85} />
 * ```
 */
export function SkillMatchIndicator(props: SkillMatchIndicatorProps) {
  return <SkillMatchCircle {...props} />;
}

export default SkillMatchIndicator;
