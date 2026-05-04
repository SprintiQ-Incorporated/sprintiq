import type { Status, Task, Workspace, Space, Project, Sprint } from "@/lib/database-aliases";
import { format, parseISO } from "date-fns";

export const colorMap: Record<string, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  gray: "bg-gray-500",
  orange: "bg-orange-500",
  indigo: "bg-indigo-500",
  teal: "bg-teal-500",
};

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

export const getStatusColor = (status: Status): string => {
  return status.color ? colorMap[status.color] : "bg-gray-500";
};

export { generateTaskId } from "@/lib/branded-ids";

export const generateTagId = (): string => {
  return `tag${Math.floor(Math.random() * 1000000000000)
    .toString()
    .padStart(12, "0")}`;
};

export const getAvailableTagColors = (): string[] => {
  return [
    "red",
    "blue",
    "green",
    "yellow",
    "purple",
    "pink",
    "gray",
    "orange",
    "indigo",
    "teal",
  ];
};

export const getRandomTagColor = (): string => {
  const colors = getAvailableTagColors();
  return colors[Math.floor(Math.random() * colors.length)];
};

export const getCompletedStatus = (statuses: Status[]): Status | null => {
  return (
    statuses.find(
      (s) =>
        s.name.toLowerCase().includes("done") ||
        s.name.toLowerCase().includes("complete")
    ) || statuses[statuses.length - 1]
  );
};

export const getTodoStatus = (statuses: Status[]): Status | null => {
  return statuses[0] || null;
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Error copying to clipboard:", error);
    return false;
  }
};

export const getTaskUrl = (workspaceId: string, taskId: string): string => {
  return `${window.location.origin}/${workspaceId}/task/${taskId}`;
};

const priorityLabels: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const formatDate = (dateStr: string | null | undefined): string | null => {
  if (!dateStr) return null;
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return null;
  }
};

export const formatTaskAsMarkdown = (
  task: Task,
  workspace: Workspace,
  space: Space,
  project: Project | null,
  sprint: Sprint | null,
  subtasks: Task[],
  statuses: Status[]
): string => {
  const lines: string[] = [];
  const taskUrl = getTaskUrl(workspace.workspace_id, task.task_id);

  // Title
  lines.push(`# ${task.name}`);

  // ID | Status | Priority line
  const headerParts: string[] = [`**ID:** ${task.task_id}`];
  if (task.status?.name) headerParts.push(`**Status:** ${task.status.name}`);
  if (task.priority) headerParts.push(`**Priority:** ${priorityLabels[task.priority] || task.priority}`);
  lines.push(headerParts.join(" | "));

  // Assignee
  const assigneeName = task.assignee?.full_name;
  if (assigneeName) lines.push(`**Assignee:** ${assigneeName}`);

  // Dates
  const dueDateStr = formatDate(task.due_date);
  const startDateStr = formatDate(task.start_date);
  if (dueDateStr || startDateStr) {
    const dateParts: string[] = [];
    if (dueDateStr) dateParts.push(`**Due Date:** ${dueDateStr}`);
    if (startDateStr) dateParts.push(`**Start Date:** ${startDateStr}`);
    lines.push(dateParts.join(" | "));
  }

  // Location: Workspace → Space → Project
  lines.push("");
  const locationParts = [`**Workspace:** ${workspace.name}`, `**Space:** ${space.name}`];
  if (project) locationParts.push(`**Project:** ${project.name}`);
  lines.push(locationParts.join(" → "));

  if (sprint?.name) lines.push(`**Sprint:** ${sprint.name}`);

  lines.push("");
  lines.push("---");

  // Description
  if (task.description?.trim()) {
    lines.push("");
    lines.push("## Description");
    lines.push(task.description.trim());
  }

  // Subtasks
  if (subtasks.length > 0) {
    const completedStatus = getCompletedStatus(statuses);
    const completedCount = subtasks.filter((st) => st.status_id === completedStatus?.id).length;
    lines.push("");
    lines.push(`## Subtasks (${completedCount}/${subtasks.length})`);
    for (const st of subtasks) {
      const done = st.status_id === completedStatus?.id;
      lines.push(`- [${done ? "x" : " "}] ${st.name}`);
    }
  }

  // Tags
  const taskTags = (task.task_tags || []).map((tt: any) => tt.tag?.name).filter(Boolean);
  if (taskTags.length > 0) {
    lines.push("");
    lines.push("## Tags");
    lines.push(taskTags.map((t: string) => `\`${t}\``).join(" "));
  }

  // Planning table
  const planningFields: [string, number | null | undefined][] = [
    ["Story Points", task.story_points],
    ["Estimate", task.estimated_time],
    ["Business Value", task.business_value],
    ["User Impact", task.user_impact],
    ["Complexity", task.complexity],
    ["Risk", task.risk],
  ];
  const populatedFields = planningFields.filter(([, v]) => v != null);
  if (populatedFields.length > 0) {
    lines.push("");
    lines.push("## Planning");
    lines.push("| Field | Value |");
    lines.push("|-------|-------|");
    for (const [label, value] of populatedFields) {
      const display = label === "Estimate" ? `${value}h` : String(value);
      lines.push(`| ${label} | ${display} |`);
    }
  }

  // Acceptance Criteria
  if (task.acceptance_criteria && task.acceptance_criteria.length > 0) {
    lines.push("");
    lines.push("## Acceptance Criteria");
    for (const criterion of task.acceptance_criteria) {
      lines.push(`- [ ] ${criterion}`);
    }
  }

  // AI Metadata
  const hasAiFields = task.generated_by_ai || task.persona?.name || task.success_pattern || (task.anti_pattern_warnings && task.anti_pattern_warnings.length > 0);
  if (hasAiFields) {
    lines.push("");
    lines.push("## AI Metadata");
    if (task.generated_by_ai != null) lines.push(`- **Generated by AI:** ${task.generated_by_ai ? "Yes" : "No"}`);
    if (task.persona?.name) lines.push(`- **Persona:** ${task.persona.name}`);
    if (task.success_pattern) lines.push(`- **Success Pattern:** ${task.success_pattern}`);
    if (task.anti_pattern_warnings && task.anti_pattern_warnings.length > 0) {
      lines.push(`- **Anti-pattern Warnings:** ${task.anti_pattern_warnings.join(", ")}`);
    }
  }

  // Footer
  lines.push("");
  lines.push("---");
  lines.push(`[View in SprintiQ](${taskUrl})`);

  return lines.join("\n");
};
