/**
 * Default tags for task management.
 * These tags are seeded when a new workspace is created.
 */

export interface DefaultTag {
  name: string;
  color: string;
  category: "type" | "priority" | "component" | "process";
}

export const DEFAULT_TAGS: DefaultTag[] = [
  // Type Tags - What kind of work is this?
  { name: "feature", color: "#4CAF50", category: "type" },
  { name: "bug", color: "#F44336", category: "type" },
  { name: "improvement", color: "#2196F3", category: "type" },
  { name: "tech-debt", color: "#FF9800", category: "type" },
  { name: "spike", color: "#9C27B0", category: "type" },
  { name: "documentation", color: "#607D8B", category: "type" },
  { name: "test", color: "#00BCD4", category: "type" },

  // Priority/Effort Tags - How urgent or important is this?
  { name: "quick-win", color: "#8BC34A", category: "priority" },
  { name: "blocked", color: "#E91E63", category: "priority" },
  { name: "needs-review", color: "#FFC107", category: "priority" },
  { name: "critical", color: "#B71C1C", category: "priority" },

  // Component Tags - What part of the system does this affect?
  { name: "frontend", color: "#3F51B5", category: "component" },
  { name: "backend", color: "#009688", category: "component" },
  { name: "api", color: "#673AB7", category: "component" },
  { name: "database", color: "#795548", category: "component" },
  { name: "infrastructure", color: "#455A64", category: "component" },
  { name: "mobile", color: "#FF5722", category: "component" },
  { name: "ux", color: "#E91E63", category: "component" },

  // Process Tags - Where is this in the workflow?
  { name: "ready-for-dev", color: "#4CAF50", category: "process" },
  { name: "in-review", color: "#FFC107", category: "process" },
  { name: "needs-design", color: "#E91E63", category: "process" },
  { name: "needs-qa", color: "#00BCD4", category: "process" },
  { name: "wont-fix", color: "#9E9E9E", category: "process" },
  { name: "duplicate", color: "#757575", category: "process" },
];

/**
 * Prepare default tags for database insertion
 * @param workspaceId - The workspace ID to associate the tags with
 * @returns Array of tag objects ready for insertion
 */
export function prepareDefaultTagsForInsert(workspaceId: string) {
  return DEFAULT_TAGS.map((tag) => ({
    name: tag.name,
    color: tag.color,
    workspace_id: workspaceId,
  }));
}
