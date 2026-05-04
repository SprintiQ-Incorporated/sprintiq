/**
 * AI Server Actions - Barrel Export
 *
 * Modular exports for all AI-powered server actions.
 * Original file: ai-actions.ts (3,594 lines)
 * Split into domain-specific modules for maintainability.
 *
 * Structure:
 * - shared/ai-client.ts - Common AI utilities (Anthropic client, embeddings)
 * - story-actions.ts - Story generation/enhancement (generateTAWOSStories, saveUserStory, etc.)
 * - sprint-actions.ts - Sprint planning/creation (createSprintFromStories, createSprints, etc.)
 * - task-actions.ts - Task generation/management (createTaskWithAI, analyzeTaskDependencies, etc.)
 * - project-actions.ts - Project/Space creation (createSpaceAndProject, validateProjectId, etc.)
 * - team-actions.ts - Team member management (saveTeamMember)
 */

// Story actions
export {
  generateTAWOSStories,
  saveUserStory,
  saveUserStoryToDestination,
  analyzeStoryDependencies,
  type StoryGenerationParams,
} from "./story-actions";

// Sprint actions
export {
  createSprintFromStories,
  createSprintFolder,
  createSprints,
  reformatSprintDescription,
  formatStoriesForDisplay,
  generateFormattedSprintSummary,
} from "./sprint-actions";

// Task actions
export {
  createTaskWithAI,
  findSimilarTasksWithAI,
  generateTaskDescription,
  analyzeTaskDependencies,
} from "./task-actions";

// Project/Space actions
export {
  validateProjectId,
  generateProjectSuggestions,
  createSpaceAndProject,
} from "./project-actions";

// NOTE: Do NOT re-export `anthropic` or `generateEmbedding` here. This barrel
// has no "use server" directive (it can't — it re-exports non-async values),
// so any non-action re-export pulls its source module into the client bundle
// whenever a "use client" component imports a server action from this barrel.
// That leak is how the Anthropic SDK ended up constructed in the browser
// (SDK 0.27+ hard-fails on browser construction). Import those symbols
// directly from their canonical modules in server-only code:
//   import { anthropic } from "@/app/[workspaceId]/actions/shared/ai-client";
//   import { generateEmbedding } from "@/lib/embedding-service";
