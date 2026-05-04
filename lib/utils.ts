import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { PieChartColors, ThemeColors } from "@/types";

// Re-export consolidated color utilities from single source of truth
export {
  colorMap,
  textColorMap,
  colorMapStatusBoardBg,
  tagColorClasses,
  getStatusColorByName,
  getIconColor,
} from "@/lib/utils/colors";

// Import for local use
import { getStatusColorByName } from "@/lib/utils/colors";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get status color by color name string
 * @deprecated Use getStatusColorByName from @/lib/utils/colors instead
 */
export const getStatusColor = (color: string): string => {
  return getStatusColorByName(color);
};

export const getAvatarInitials = (
  fullName?: string | null,
  email?: string | null
): string => {
  if (fullName) {
    const names = fullName.trim().split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return names[0][0].toUpperCase();
  }
  return email ? email[0].toUpperCase() : "U";
};

export const getColorByIndex = (color: string) => {
  return PieChartColors.find((c) => c.name === color)?.hex;
};
export const getColorByLabel = (color: string) => {
  return ThemeColors.find((c) => c.label === color)?.hex;
};

export const getPriorityColor = (priority?: string) => {
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

export const getUtilizationColor = (utilization: number) => {
  if (utilization > 100) return "text-red-600";
  if (utilization > 90) return "text-orange-600";
  if (utilization > 70) return "text-green-600";
  return "text-blue-600";
};

export const getRiskColor = (riskLevel: string) => {
  switch (riskLevel) {
    case "High":
      return "text-red-600 bg-red-50";
    case "Medium":
      return "text-yellow-600 bg-yellow-50";
    case "Low":
      return "text-green-600 bg-green-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
};

export const getStatusTypeColor = (statusType: string) => {
  switch (statusType) {
    case "not-started":
      return "#6B7280";
    case "Not Started":
      return "#6B7280";
    case "active":
      return "#3B82F6";
    case "Active":
      return "#3B82F6";
    case "done":
      return "#10B981";
    case "Done":
      return "#10B981";
    case "closed":
      return "#8B5CF6";
    case "Closed":
      return "#8B5CF6";
    default:
      return "#6B7280";
  }
};

export const getStatusTypeBgColor = (statusType: string) => {
  switch (statusType) {
    case "not-started":
      return "bg-gray-500/10";
    case "active":
      return "bg-blue-500/10";
    case "done":
      return "bg-green-500/10";
    case "closed":
      return "bg-purple-500/10";
    default:
      return "bg-gray-500/10";
  }
};

export const getStatusTypeTextColor = (statusType: string) => {
  switch (statusType) {
    case "not-started":
      return "text-gray-500";
    case "active":
      return "text-blue-500";
    case "done":
      return "text-green-500";
    case "closed":
      return "text-purple-500";
    default:
      return "text-gray-500";
  }
};

export const getStatusTypeText = (statusType: string) => {
  switch (statusType) {
    case "not-started":
      return "Not Started";
    case "active":
      return "Active";
    case "done":
      return "Done";
    case "closed":
      return "Closed";
    default:
      return "Not Started";
  }
};

export const getStatusTypeChartColor = (statusType: string) => {
  switch (statusType) {
    case "Not Started":
      return "hsl(220, 9%, 46%)";
    case "Active":
      return "hsl(217, 91%, 60%)";
    case "Done":
      return "hsl(141, 71%, 48%)";
    case "Closed":
      return "hsl(276, 80%, 80%)";
    default:
      return "hsl(220, 9%, 46%)";
  }
};

