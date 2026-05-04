import {
  format,
  parseISO,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import type { Status, Task } from "@/lib/database-aliases";
import { colorMap, colorMapStatusBoardBg } from "./types";

export const getStatusColor = (status: Status): string => {
  return colorMap[status.color as keyof typeof colorMap] || "bg-gray-500";
};

export const getStatusBoardBgColor = (status: Status): string => {
  return (
    colorMapStatusBoardBg[status.color as keyof typeof colorMapStatusBoardBg] ||
    "bg-gray-500/10"
  );
};

export const getStatusBadge = (_status: Status): string | null => {
  return null; // Unified statuses; no scope badge
};

export const generateDateRange = (weeksAhead: number = 4) => {
  const today = new Date();
  const startDate = startOfMonth(today);
  const endDate = endOfMonth(addDays(today, weeksAhead * 7));
  return eachDayOfInterval({ start: startDate, end: endDate });
};

export const generateWeeks = (dateRange: Date[]) => {
  const weeks: Record<string, Date[]> = {};
  dateRange.forEach((date) => {
    const weekNum = `W${format(date, "w")}`;
    if (!weeks[weekNum]) {
      weeks[weekNum] = [];
    }
    weeks[weekNum].push(date);
  });
  return weeks;
};

export const getTaskBarPosition = (
  task: Task,
  dateRange: Date[]
): { left: number; width: number } => {
  const today = new Date();
  const startDateObj = task.start_date ? parseISO(task.start_date) : today;
  const dueDateObj = task.due_date
    ? parseISO(task.due_date)
    : addDays(startDateObj, 1);

  const startIndex = dateRange.findIndex(
    (d) => format(d, "yyyy-MM-dd") === format(startDateObj, "yyyy-MM-dd")
  );

  const endIndex = dateRange.findIndex(
    (d) => format(d, "yyyy-MM-dd") === format(dueDateObj, "yyyy-MM-dd")
  );

  const left = Math.max(0, startIndex) * 40;
  const width = Math.max(40, (endIndex - startIndex + 1) * 40);

  return { left, width };
};

export const copyTaskLink = (taskId: string, workspaceId: string): void => {
  const taskUrl = `${window.location.origin}/${workspaceId}/task/${taskId}`;
  navigator.clipboard.writeText(taskUrl);
};

export const filterTasksByStatus = (tasks: Task[]): Record<string, Task[]> => {
  return tasks
    .filter((task) => !task.parent_task_id)
    .reduce((acc, task) => {
      const statusId = task.status_id || "unknown";
      if (!acc[statusId]) acc[statusId] = [];
      acc[statusId].push(task);
      return acc;
    }, {} as Record<string, Task[]>);
};

export const getSubtasksForTask = (
  taskId: string,
  allSubtasks: Task[]
): Task[] => {
  return allSubtasks.filter((task) => task.parent_task_id === taskId);
};

export const formatDateRange = (
  startDate?: string,
  dueDate?: string
): string => {
  if (startDate && !dueDate) {
    return `Starts ${format(parseISO(startDate), "MMM d")}`;
  }
  if (dueDate && !startDate) {
    return format(parseISO(dueDate), "MMM d");
  }
  if (startDate && dueDate) {
    return `${format(parseISO(startDate), "MMM d")} - ${format(
      parseISO(dueDate),
      "MMM d"
    )}`;
  }
  return "";
};

export const stripFormatting = (text: string): string => {
  if (!text) return "";

  // First remove markdown formatting
  const withoutMarkdown = text
    // Remove headers (# and ##)
    .replace(/^#+\s*/gm, "")
    // Remove bold/italic (**text** or *text*)
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1")
    // Remove list markers
    .replace(/^[-*+]\s+/gm, "")
    // Remove numbered lists
    .replace(/^\d+\.\s+/gm, "")
    // Remove blockquotes
    .replace(/^>\s+/gm, "")
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1");

  // Then remove HTML tags - check if we're in browser environment
  if (typeof document !== "undefined") {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = withoutMarkdown;
    return tempDiv.textContent || tempDiv.innerText || "";
  } else {
    // Fallback for server-side rendering - use regex to remove HTML tags
    return withoutMarkdown
      .replace(/<[^>]*>/g, "") // Remove HTML tags
      .replace(/&[a-zA-Z]+;/g, "") // Remove HTML entities
      .trim();
  }
};
