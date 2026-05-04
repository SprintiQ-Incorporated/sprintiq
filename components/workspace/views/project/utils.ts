import {
  format,
  parseISO,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import type { Status, Task } from "@/lib/database-aliases";
import { colorMap, colorMapStatusBoardBg, textColorMap } from "./types";

export const getStatusColor = (status: Status): string => {
  return colorMap[status.color as keyof typeof colorMap] || "bg-gray-500";
};

export const getStatusTextColor = (status: Status): string => {
  return (
    textColorMap[status.color as keyof typeof textColorMap] || "text-gray-500"
  );
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

/**
 * The 5 canonical status columns for Board and List views.
 * ALL statuses are mapped to one of these based on name/type.
 */
const CANONICAL_ORDER = ["Backlog", "To Do", "In Progress", "Testing", "Done"] as const;

const CANONICAL_COLORS: Record<string, string> = {
  "Backlog": "gray",
  "To Do": "gray",
  "In Progress": "blue",
  "Testing": "yellow",
  "Done": "green",
};

/**
 * Map any status to one of the 5 canonical column names
 * based on its name and status_type.
 */
export const getCanonicalStatusName = (status: any): string => {
  const name = (status.name || "").toLowerCase();
  const typeName = status.status_type?.name?.toLowerCase() || "";

  // Done / Closed
  if (
    typeName === "done" || typeName === "closed" ||
    name.includes("done") || name.includes("complete") ||
    name.includes("closed") || name.includes("resolved")
  ) {
    return "Done";
  }

  // Testing / QA
  if (
    typeName === "testing" ||
    name.includes("testing") || name.includes("test") || name.includes("qa")
  ) {
    return "Testing";
  }

  // Not-started → Backlog or To Do
  if (typeName === "not-started") {
    if (name.includes("backlog") || name.includes("turbo")) return "Backlog";
    return "To Do";
  }

  // Active → In Progress (unless it's testing-like)
  if (typeName === "active" || typeName === "blocked") {
    return "In Progress";
  }

  // Fallback by name
  if (name.includes("backlog") || name.includes("turbo")) return "Backlog";
  if (name.includes("to do") || name.includes("todo") || name === "open" || name === "new") return "To Do";
  if (name.includes("progress") || name.includes("doing") || name.includes("review") || name.includes("implementation")) return "In Progress";

  return "In Progress"; // Final fallback
};

/**
 * Aggregate all statuses into the 5 canonical columns.
 * Returns one column per canonical name (in order), each with:
 *   - a representative status object (for DnD/StatusColumn compatibility)
 *   - a Set of ALL status IDs that map to this column
 *
 * @param statuses - raw statuses from state (may contain duplicates)
 * @param excludeBacklog - if true, omit the Backlog column (Turbo Tasks tab handles those)
 */
export const aggregateStatuses = (
  statuses: any[],
  excludeBacklog = false
): { columns: any[]; statusIdsByColumn: Map<string, Set<string>> } => {
  const columnMap = new Map<string, { status: any; ids: Set<string> }>();

  for (const status of statuses) {
    const canonical = getCanonicalStatusName(status);
    if (!columnMap.has(canonical)) {
      // Use first matching status as the representative, but override display name/color
      columnMap.set(canonical, {
        status: { ...status, name: canonical, color: CANONICAL_COLORS[canonical] || status.color },
        ids: new Set([status.id]),
      });
    } else {
      columnMap.get(canonical)!.ids.add(status.id);
    }
  }

  const statusIdsByColumn = new Map<string, Set<string>>();
  const columns: any[] = [];

  for (const name of CANONICAL_ORDER) {
    if (excludeBacklog && name === "Backlog") continue;
    const entry = columnMap.get(name);
    if (entry) {
      columns.push(entry.status);
      statusIdsByColumn.set(name, entry.ids);
    } else {
      // Always show canonical columns even if no status maps to them yet
      columns.push({
        id: `canonical-${name.toLowerCase().replace(/\s+/g, "-")}`,
        name,
        color: CANONICAL_COLORS[name] || "gray",
        position: CANONICAL_ORDER.indexOf(name),
        type: "space",
      });
      statusIdsByColumn.set(name, new Set());
    }
  }

  return { columns, statusIdsByColumn };
};

/**
 * Check if a task belongs in a given canonical column.
 */
export const taskMatchesColumn = (
  task: any,
  column: any,
  statusIdsByColumn: Map<string, Set<string>>
): boolean => {
  const ids = statusIdsByColumn.get(column.name);
  return ids ? ids.has(task.status_id) : false;
};

/**
 * Deduplicate statuses by name, keeping the first occurrence (by position).
 * Returns the deduped list and a Set of all status IDs that map to each
 * deduplicated column, so tasks pointing to any duplicate still render
 * in the correct column.
 */
export const deduplicateStatuses = (
  statuses: any[]
): { deduped: any[]; statusIdsByName: Map<string, Set<string>> } => {
  const seen = new Map<string, any>();
  const statusIdsByName = new Map<string, Set<string>>();

  for (const status of statuses) {
    const key = status.name.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, status);
      statusIdsByName.set(key, new Set([status.id]));
    } else {
      statusIdsByName.get(key)!.add(status.id);
    }
  }

  return {
    deduped: Array.from(seen.values()),
    statusIdsByName,
  };
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

export const filterTasks = (
  tasks: Task[],
  filters: {
    status: string[];
    tags: string[];
    priority: string[];
    assigned: string[];
    sprintPoints: { min: number; max: number };
    showUnassignedOnly: boolean;
  }
): Task[] => {
  return tasks.filter((task) => {
    // Status filter
    if (filters.status.length > 0 && !filters.status.includes(task.status_id)) {
      return false;
    }

    // Tags filter
    if (filters.tags.length > 0) {
      const taskTagIds = task.task_tags?.map((tt: any) => tt.tag.id) || [];
      const hasMatchingTag = filters.tags.some((tagId) =>
        taskTagIds.includes(tagId)
      );
      if (!hasMatchingTag) return false;
    }

    // Priority filter
    if (
      filters.priority.length > 0 &&
      !filters.priority.includes(task.priority!)
    ) {
      return false;
    }

    // Assigned filter
    if (filters.showUnassignedOnly) {
      // Show only unassigned tasks
      if (task.assignee_id) {
        return false;
      }
    } else if (filters.assigned.length > 0) {
      // Show only tasks assigned to specific users
      if (!filters.assigned.includes(task.assignee_id ?? "")) {
        return false;
      }
    }

    // Sprint points filter (if task has sprint_points property)
    if (typeof (task as any).sprint_points === "number") {
      const points = (task as any).sprint_points;
      if (
        points < filters.sprintPoints.min ||
        points > filters.sprintPoints.max
      ) {
        return false;
      }
    }

    return true;
  });
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

  // Then remove HTML tags
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = withoutMarkdown;
  return tempDiv.textContent || tempDiv.innerText || "";
};
