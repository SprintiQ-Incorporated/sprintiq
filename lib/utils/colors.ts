/**
 * Consolidated color utilities for the application
 * Single source of truth for all color mappings
 */

import type { Status } from "@/lib/database-aliases";

/**
 * Base color map for status backgrounds
 */
export const colorMap: Record<string, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  indigo: "bg-indigo-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  cyan: "bg-cyan-500",
  gray: "bg-gray-500",
};

/**
 * Text color map for status text
 */
export const textColorMap: Record<string, string> = {
  red: "text-red-500",
  blue: "text-blue-500",
  green: "text-green-500",
  yellow: "text-yellow-500",
  purple: "text-purple-500",
  pink: "text-pink-500",
  indigo: "text-indigo-500",
  orange: "text-orange-500",
  teal: "text-teal-500",
  cyan: "text-cyan-500",
  gray: "text-gray-500",
};

/**
 * Semi-transparent background color map for status columns
 */
export const colorMapStatusBoardBg: Record<string, string> = {
  red: "bg-red-500/10",
  blue: "bg-blue-500/10",
  green: "bg-green-500/10",
  yellow: "bg-yellow-500/10",
  purple: "bg-purple-500/10",
  pink: "bg-pink-500/10",
  indigo: "bg-indigo-500/10",
  orange: "bg-orange-500/10",
  teal: "bg-teal-500/10",
  cyan: "bg-cyan-500/10",
  gray: "bg-gray-500/10",
};

/**
 * Tag color classes combining background and text
 */
export const tagColorClasses: Record<string, string> = {
  red: "bg-red-100 text-red-800",
  blue: "bg-blue-100 text-blue-800",
  green: "bg-green-100 text-green-800",
  yellow: "bg-yellow-100 text-yellow-800",
  purple: "bg-purple-100 text-purple-800",
  pink: "bg-pink-100 text-pink-800",
  gray: "bg-gray-100 text-gray-800",
  orange: "bg-orange-100 text-orange-800",
  indigo: "bg-indigo-100 text-indigo-800",
  teal: "bg-teal-100 text-teal-800",
};

/**
 * Priority colors with label, text color, and background
 */
export const priorityColors: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  critical: {
    label: "Critical",
    color: "text-red-600",
    bgColor: "bg-red-600/10",
  },
  high: {
    label: "High",
    color: "text-yellow-600",
    bgColor: "bg-yellow-600/10",
  },
  medium: {
    label: "Medium",
    color: "text-blue-600",
    bgColor: "bg-blue-600/10",
  },
  low: {
    label: "Low",
    color: "text-green-600",
    bgColor: "bg-green-600/10",
  },
};

/**
 * Get status background color from Status object
 * Primary consolidated function - use this instead of local implementations
 */
export const getStatusColor = (status: Status): string => {
  return colorMap[status.color as keyof typeof colorMap] || "bg-gray-500";
};

/**
 * Get status background color from color string
 * Use when you only have a color name, not a full Status object
 */
export const getStatusColorByName = (color: string): string => {
  return colorMap[color as keyof typeof colorMap] || "bg-gray-500";
};

/**
 * Get status text color from Status object
 */
export const getStatusTextColor = (status: Status): string => {
  return textColorMap[status.color as keyof typeof textColorMap] || "text-gray-500";
};

/**
 * Get status board background color from Status object
 */
export const getStatusBoardBgColor = (status: Status): string => {
  return (
    colorMapStatusBoardBg[status.color as keyof typeof colorMapStatusBoardBg] ||
    "bg-gray-500/10"
  );
};

/**
 * Get priority color configuration
 */
export const getPriorityColorConfig = (
  priority?: string
): { label: string; color: string; bgColor: string } => {
  const key = priority?.toLowerCase() || "medium";
  return priorityColors[key] || priorityColors.medium;
};

/**
 * Get priority color class for backgrounds
 */
export const getPriorityColor = (priority?: string): string => {
  switch (priority?.toLowerCase()) {
    case "critical":
      return "bg-red-600/10 text-red-600";
    case "high":
      return "bg-yellow-600/10 text-yellow-600";
    case "medium":
      return "bg-blue-600/10 text-blue-600";
    case "low":
      return "bg-green-600/10 text-green-600";
    default:
      return "bg-gray-600/10 text-gray-600";
  }
};

/**
 * Icon color map for workspace/space icons
 */
export const iconColorMap: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
  yellow: "bg-yellow-500",
  pink: "bg-pink-500",
};

/**
 * Get icon color from icon value
 */
export const getIconColor = (iconValue: string | null | undefined): string => {
  return (iconValue && iconColorMap[iconValue]) || "bg-blue-500";
};
