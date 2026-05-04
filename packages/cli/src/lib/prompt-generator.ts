import type { TaskData } from "../types.js";
import { MAX_DESCRIPTION_LENGTH, MAX_PROMPT_LENGTH } from "./constants.js";

export interface PromptOptions {
  includeSubtasks?: boolean;
  customInstructions?: string;
  taskUrl: string;
}

/**
 * Generates a structured markdown prompt optimized for Claude Code
 * from enriched task data.
 */
export function generatePrompt(task: TaskData, options: PromptOptions): string {
  const sections: string[] = [];

  // Title
  sections.push(`# ${escapeHtml(task.name)}`);

  // Metadata block
  const meta: string[] = [];
  meta.push(`**ID:** ${task.task_id}`);
  if (task.status) meta.push(`**Status:** ${task.status.name}`);
  if (task.priority) meta.push(`**Priority:** ${task.priority}`);
  if (task.sprint) {
    const dates = formatSprintDates(task.sprint.start_date, task.sprint.end_date);
    meta.push(`**Sprint:** ${task.sprint.name}${dates ? ` (${dates})` : ""}`);
  }
  if (task.story_points != null) meta.push(`**Estimate:** ${task.story_points}pts`);
  if (task.type) meta.push(`**Type:** ${task.type}`);
  if (task.assignee) meta.push(`**Assignee:** ${task.assignee.full_name}`);
  if (task.epic) meta.push(`**Epic:** ${task.epic.name}`);
  if (task.project) meta.push(`**Project:** ${task.project.name}`);
  if (task.space) meta.push(`**Space:** ${task.space.name}`);
  sections.push(meta.join(" | "));

  // User Story / Description
  if (task.description) {
    sections.push("## User Story");
    let description = task.description;
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      description =
        description.slice(0, MAX_DESCRIPTION_LENGTH) +
        `\n\n[truncated — see full task in SprintIQ](${options.taskUrl})`;
    }
    sections.push(description);
  }

  // Acceptance Criteria — never truncated
  if (task.acceptance_criteria && task.acceptance_criteria.length > 0) {
    sections.push("## Acceptance Criteria");
    const acLines = task.acceptance_criteria.map(
      (ac, i) => `${i + 1}. ${ac}`
    );
    sections.push(acLines.join("\n"));
  }

  // Dependencies
  if (task.dependencies.length > 0) {
    sections.push("## Dependencies");
    const depLines = task.dependencies.map((dep) => {
      const status = dep.is_completed ? "completed" : "pending";
      return `- **${dep.type}** ${dep.task_id} — ${dep.name} (${status})`;
    });
    sections.push(depLines.join("\n"));
  }

  // Subtasks
  if (
    options.includeSubtasks &&
    task.subtasks &&
    task.subtasks.length > 0
  ) {
    const incomplete = task.subtasks.filter((st) => !st.is_completed);
    if (incomplete.length > 0) {
      sections.push("## Subtasks");
      const stLines = incomplete.map(
        (st) => `- [ ] ${st.task_id} — ${st.name} (${st.status_name})`
      );
      sections.push(stLines.join("\n"));
    }
  }

  // Technical Context
  if (task.tags.length > 0) {
    sections.push("## Technical Context");
    sections.push(`**Tech stack:** ${task.tags.join(", ")}`);
  }

  // Instructions
  sections.push("## Instructions");
  let instructions =
    "Implement the requirements described above, ensuring all acceptance criteria are met. " +
    "If you encounter ambiguity or blockers, report them clearly rather than making assumptions. " +
    "Write clean, well-tested code that follows existing project conventions.";
  if (options.customInstructions) {
    instructions += `\n\n${options.customInstructions}`;
  }
  sections.push(instructions);

  // When You're Done — instruct Claude to write a completion report
  sections.push("## **IMPORTANT:** When You're Done");
  sections.push(
    `**You MUST write a file \`.sprintiq/report.json\` before finishing.** This file is read automatically to report progress to your team.\n` +
    "```json\n" +
    "{\n" +
    `  "status": "completed" | "blocked" | "needs_review",\n` +
    `  "summary": "What was accomplished",\n` +
    `  "ac_results": [{ "index": 0, "met": true, "evidence": "..." }],\n` +
    `  "issues": [{ "type": "bug"|"tech_debt"|"followup", "title": "...", "description": "...", "severity": "low"|"medium"|"high"|"critical", "file_path": "...", "line_number": 123, "suggested_points": 1 }]\n` +
    "}\n" +
    "```\n" +
    "At minimum, include `status` and `summary`. All other fields optional."
  );

  let prompt = sections.join("\n\n");

  // Enforce total length cap — trim metadata before AC
  if (prompt.length > MAX_PROMPT_LENGTH) {
    // Re-generate with trimmed description
    const trimmedDesc = task.description
      ? task.description.slice(0, 2000) +
        `\n\n[truncated — see full task in SprintIQ](${options.taskUrl})`
      : null;
    const trimmedTask = { ...task, description: trimmedDesc };
    const regenSections: string[] = [];
    regenSections.push(`# ${escapeHtml(trimmedTask.name)}`);
    regenSections.push(`**ID:** ${trimmedTask.task_id} | **Priority:** ${trimmedTask.priority}`);
    if (trimmedTask.description) {
      regenSections.push("## User Story");
      regenSections.push(trimmedTask.description);
    }
    if (trimmedTask.acceptance_criteria && trimmedTask.acceptance_criteria.length > 0) {
      regenSections.push("## Acceptance Criteria");
      regenSections.push(
        trimmedTask.acceptance_criteria.map((ac, i) => `${i + 1}. ${ac}`).join("\n")
      );
    }
    regenSections.push("## Instructions");
    regenSections.push(instructions);
    regenSections.push("## **IMPORTANT:** When You're Done");
    regenSections.push(
      '**You MUST write `.sprintiq/report.json` before finishing.** This file is read automatically to report progress to your team. Format: `{ "status": "completed"|"blocked"|"needs_review", "summary": "...", "ac_results": [...], "issues": [...] }`. At minimum, include `status` and `summary`.'
    );
    prompt = regenSections.join("\n\n");
  }

  return prompt;
}

function escapeHtml(text: string): string {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatSprintDates(
  start: string | null,
  end: string | null
): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) => d.split("T")[0];
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  if (start) return `from ${fmt(start)}`;
  return `until ${fmt(end!)}`;
}
