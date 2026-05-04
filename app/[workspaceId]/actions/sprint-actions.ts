"use server";

/**
 * Sprint-related server actions
 * Extracted from ai-actions.ts
 *
 * Includes:
 * - createSprintFromStories - Create sprint from stories
 * - createSprintFolder - Create sprint folder
 * - createSprints - Create multiple sprints
 * - reformatSprintDescription - Reformat sprint descriptions
 * - formatStoriesForDisplay - Format stories for UI display
 * - generateFormattedSprintSummary - Generate formatted sprint summary
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { TeamMember, UserStory } from "@/types";
import type { EnhancedSprint } from "@/lib/sprint-creation-service";
import SprintCreationService from "@/lib/sprint-creation-service";
import { getOrCreateDefaultStatuses } from "@/lib/services/statusService";
import {
  formatSprintDescription,
  formatUserStory,
  getDescriptionReformatterSystemPrompt,
} from "@/lib/prompts/sprint-description-prompts";
import { anthropic } from "./shared/ai-client";
import { extractAIUsage, trackAIUsage } from "@/lib/ai-usage-tracker";
import { HOURS_PER_STORY_POINT } from "@/lib/constants/statusTypes";

/**
 * Group stories by dependencies to ensure dependent stories are in the same sprint
 */
function groupStoriesByDependencies(stories: UserStory[]): UserStory[][] {
  const groups: UserStory[][] = [];
  const visited = new Set<string>();

  for (const story of stories) {
    if (visited.has(story.id)) continue;

    const group = findDependencyGroup(story, stories, visited);
    groups.push(group);
  }

  return groups;
}

/**
 * Find all stories that are dependent on each other
 */
function findDependencyGroup(
  story: UserStory,
  allStories: UserStory[],
  visited: Set<string>
): UserStory[] {
  const group: UserStory[] = [];
  const queue: UserStory[] = [story];

  while (queue.length > 0) {
    const currentStory = queue.shift()!;
    if (visited.has(currentStory.id)) continue;

    visited.add(currentStory.id);
    group.push(currentStory);

    // Find stories that depend on this story
    const dependents = allStories.filter(
      (s) => s.dependencies && s.dependencies.includes(currentStory.id)
    );

    // Find stories that this story depends on
    const dependencies = allStories.filter(
      (s) => currentStory.dependencies && currentStory.dependencies.includes(s.id)
    );

    queue.push(...dependents, ...dependencies);
  }

  return group;
}

/**
 * Create enhanced sprint with AI support and proper capacity management
 */
export async function createSprintFromStories(
  stories: UserStory[],
  teamMembers: TeamMember[],
  sprintDuration: number = 2,
  workspaceId: string
): Promise<{
  sprint: EnhancedSprint | null;
  error?: string;
}> {
  try {
    if (stories.length === 0) {
      return {
        sprint: null,
        error: "No stories available for sprint planning",
      };
    }

    if (teamMembers.length === 0) {
      return {
        sprint: null,
        error: "No team members available for sprint planning",
      };
    }

    // Calculate team capacity: 1 story point ≈ HOURS_PER_STORY_POINT hours
    const totalWeeklyHours = teamMembers.reduce(
      (sum, member) => sum + (member.availability || 40),
      0
    );
    const sprintHours = totalWeeklyHours * sprintDuration;
    const sprintCapacity = Math.floor(sprintHours / HOURS_PER_STORY_POINT);

    // Sort stories by priority (Critical > High > Medium > Low) and then by story points
    const sortedStories = [...stories].sort((a, b) => {
      const priorityOrder = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      const aPriority = priorityOrder[a.priority || "Medium"];
      const bPriority = priorityOrder[b.priority || "Medium"];

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // For same priority, prefer smaller stories first
      return (a.storyPoints || 0) - (b.storyPoints || 0);
    });

    // Group stories by dependencies to ensure dependent stories are in the same sprint
    const dependencyGroups = groupStoriesByDependencies(sortedStories);

    // Distribute stories based on capacity and dependencies
    let currentCapacity = sprintCapacity;
    const sprintStories: UserStory[] = [];
    const remainingStories: UserStory[] = [];

    for (const group of dependencyGroups) {
      const groupStoryPoints = group.reduce(
        (sum, story) => sum + (story.storyPoints || 0),
        0
      );

      if (groupStoryPoints <= currentCapacity) {
        // Add entire group to sprint
        sprintStories.push(...group);
        currentCapacity -= groupStoryPoints;
      } else {
        // Group is too large, add individual stories that fit
        for (const story of group) {
          const storyPoints = story.storyPoints || 1;
          if (storyPoints <= currentCapacity) {
            sprintStories.push(story);
            currentCapacity -= storyPoints;
          } else {
            remainingStories.push(story);
          }
        }
      }
    }

    // Create enhanced sprint using the sprint creation service
    const sprintCreationService = new SprintCreationService({
      sprintDuration: sprintDuration * 7, // Convert weeks to days
      workingDaysPerWeek: 5,
      hoursPerDay: 8,
      velocityBuffer: 0.8,
    });

    const enhancedSprints = await sprintCreationService.createDetailedSprints(
      sprintStories,
      { totalStoryPoints: sprintCapacity, totalHours: sprintHours },
      teamMembers,
      { startDate: new Date().toISOString() }
    );

    if (enhancedSprints.length === 0) {
      return {
        sprint: null,
        error: "Failed to create enhanced sprint",
      };
    }

    return { sprint: enhancedSprints[0] };
  } catch (error) {
    console.error("Error creating sprint:", error);
    return {
      sprint: null,
      error: "Failed to create sprint. Please try again.",
    };
  }
}

/**
 * Create a new sprint folder in a space
 * Sprint folders now belong to projects (via project_id) in addition to spaces
 */
export async function createSprintFolder({
  name,
  spaceId,
  projectId = null,
  durationWeeks = 2,
  sprintStartDayId = null,
}: {
  name: string;
  spaceId: string;
  projectId?: string | null;
  durationWeeks?: number;
  sprintStartDayId?: string | null;
}): Promise<{ success: boolean; sprintFolder?: any; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: sprintFolder, error } = await supabase
      .from("sprint_folders")
      .insert({
        name,
        space_id: spaceId,
        project_id: projectId,
        duration_week: durationWeeks,
        sprint_start_day_id: sprintStartDayId,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    return { success: true, sprintFolder };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Create multiple sprints in a sprint folder
 */
export async function createSprints({
  sprints,
  sprintFolderId,
  spaceId,
  workspaceId,
  projectId = null,
}: {
  sprints: Array<{
    name: string;
    goal?: string;
    startDate?: string;
    endDate?: string;
    sprint_id?: string;
    duration?: number;
  }>;
  sprintFolderId: string;
  spaceId: string;
  workspaceId: string;
  projectId?: string | null;
}): Promise<{
  success: boolean;
  createdSprints?: any[];
  createdStatuses?: any[];
  error?: string;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    const inserts = sprints.map((s) => ({
      name: s.name,
      goal: s.goal || null,
      start_date: s.startDate || null,
      end_date: s.endDate || null,
      sprint_folder_id: sprintFolderId,
      space_id: spaceId,
      workspace_id: workspaceId,
      project_id: projectId,
      duration: s.duration,
      status: "planned" as const,
    }));

    const { data: newSprint, error } = await supabase
      .from("sprints")
      .insert(inserts)
      .select();

    if (error || !newSprint) {
      console.error("Failed to create sprints:", error);
      return {
        success: false,
        error: `Failed to create sprints: ${error?.message}`,
      };
    }

    // Use centralized status service to get or create statuses
    let createdStatuses;
    try {
      createdStatuses = await getOrCreateDefaultStatuses(supabase, spaceId, workspaceId);
    } catch (statusError: any) {
      console.error("Failed to get/create statuses:", statusError);
      // Don't fail sprint creation if status creation fails
    }

    return { success: true, createdSprints: newSprint, createdStatuses };
  } catch (e: any) {
    console.error("=== createSprints ERROR ===", e);
    return { success: false, error: e.message };
  }
}

/**
 * Reformat an existing sprint description into the structured format.
 * Uses AI to parse unstructured descriptions and convert them to the standardized format
 * with Goal, User Stories, and Acceptance Criteria with checkboxes.
 *
 * @deprecated Use the ai-fast queue via POST /api/workspace/[workspaceId]/sprints/reformat instead.
 * This synchronous action blocks the caller for 3-8s. The queue-based replacement routes through
 * ai-provider.ts (circuit breaker + DeepSeek fallback) and returns a taskId for async polling.
 */
export async function reformatSprintDescription(
  existingDescription: string
): Promise<{ success: boolean; formattedDescription?: string; error?: string }> {
  try {
    const systemPrompt = getDescriptionReformatterSystemPrompt();

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Please reformat the following sprint description into the structured format:\n\n${existingDescription}`,
        },
      ],
    });

    const aiUsage = extractAIUsage(message);
    trackAIUsage({ route: "sprint-actions/reformat", usage: aiUsage }).catch(() => {});

    const textContent = message.content[0];
    if (textContent.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    return {
      success: true,
      formattedDescription: textContent.text,
    };
  } catch (error) {
    console.error("Error reformatting sprint description:", error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Format user stories with acceptance criteria checkboxes
 * This is a utility function that can be used to format stories in the UI
 */
export async function formatStoriesForDisplay(
  stories: Array<{
    title: string;
    role?: string;
    want?: string;
    benefit?: string;
    description?: string;
    acceptanceCriteria?: string[];
  }>
): Promise<string> {
  return stories
    .map((story, index) =>
      formatUserStory(
        {
          id: `story-${index}`,
          title: story.title,
          role: story.role,
          want: story.want,
          benefit: story.benefit,
          description: story.description,
          acceptanceCriteria: story.acceptanceCriteria,
        } as any,
        index + 1
      )
    )
    .join("\n\n---\n\n");
}

/**
 * Generate a complete formatted sprint summary with goal and stories
 */
export async function generateFormattedSprintSummary(
  goal: string,
  stories: Array<{
    title: string;
    role?: string;
    want?: string;
    benefit?: string;
    description?: string;
    acceptanceCriteria?: string[];
  }>
): Promise<string> {
  return formatSprintDescription(goal, stories as any);
}
