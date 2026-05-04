"use server";

/**
 * Project and Space related server actions
 * Extracted from ai-actions.ts
 *
 * Includes:
 * - validateProjectId - Validate project ID
 * - generateProjectSuggestions - Generate project suggestions
 * - createSpaceAndProject - Create space and project
 */

import { createServerSupabaseClient, getAuthUser } from "@/lib/supabase/server";
import type { UserStory } from "@/types";
import { generateProjectSuggestionsCompletion } from "@/lib/ai-provider";
import {
  getOrCreateDefaultStatuses,
  getSpaceStatuses,
} from "@/lib/services/statusService";

/**
 * Helper function to get default status colors as names
 */
function getDefaultStatusColorName(index: number): string {
  const colors = ["indigo", "yellow", "green", "red", "purple"];
  return colors[index % colors.length];
}

/**
 * Validate if a project ID exists
 */
export async function validateProjectId(
  projectId: string,
  workspaceId: string
): Promise<{
  exists: boolean;
  projectName?: string;
  spaceId?: string;
  error?: string;
}> {
  try {
    const supabase = await createServerSupabaseClient();

    // First get the workspace UUID from workspace_id
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("workspace_id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return { exists: false, error: "Workspace not found" };
    }

    // Then find the project using project_id and workspace UUID
    const { data: project, error } = await supabase
      .from("projects")
      .select("name, space_id")
      .eq("project_id", projectId)
      .eq("workspace_id", workspace.id)
      .single();

    if (error) {
      return { exists: false, error: error.message };
    }

    return {
      exists: true,
      projectName: project.name,
      spaceId: project.space_id ?? undefined,
    };
  } catch (e: any) {
    console.error("Error validating project ID:", e);
    return {
      exists: false,
      error: e.message || "Failed to validate project ID",
    };
  }
}

/**
 * Generate suggestions for space/project/status names based on feature description
 */
export async function generateProjectSuggestions(
  featureDescription: string,
  stories: UserStory[]
): Promise<{
  spaceName?: string;
  projectName?: string;
  statusNames?: string[];
  statusColors?: string[];
  error?: string;
}> {
  try {
    // Check if Claude API key is configured
    if (!process.env.CLAUDE_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      return {
        error:
          "Claude API key is not configured. Please add CLAUDE_API_KEY or ANTHROPIC_API_KEY to your environment variables.",
      };
    }

    const storiesSummary = stories.map((s) => ({
      title: s.title,
      priority: s.priority,
      complexity: s.storyPoints,
    }));

    const prompt = `
      Based on these user stories: ${JSON.stringify(storiesSummary, null, 2)}

      Generate appropriate names and workflow for:
      1. A space name (workspace area) - should be broad and encompassing
      2. A project name - should be specific to these stories
      3. Status workflow that makes sense for these stories, considering:
         - Story priorities (${stories.map((s) => s.priority).join(", ")})
         - Story points/complexity levels
         - Dependencies between stories
         - Common agile/scrum practices

      For the status workflow:
      - Suggest 4-6 statuses that make sense for this project
      - Each status should have a color from: red, blue, green, yellow, purple, pink, indigo, orange, teal, cyan, gray
      - Consider including specialized statuses if needed (e.g., "Design Review" for UI stories)
      - Status names should be clear and actionable

      Return ONLY a valid JSON object with this exact structure:
      {
        "spaceName": "suggested space name",
        "projectName": "suggested project name",
        "statusNames": ["Status 1", "Status 2", "Status 3", "Status 4"],
        "statusColors": ["color1", "color2", "color3", "color4"]
      }
    `;

    // Use AI provider routing - SIMPLE task (uses DeepSeek for cost efficiency)
    const aiResult = await generateProjectSuggestionsCompletion(prompt);
    const text = aiResult.text;

    try {
      // First try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      let suggestions;

      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        suggestions = JSON.parse(text);
      }

      // Validate the response structure
      if (
        !suggestions.spaceName ||
        !suggestions.projectName ||
        !suggestions.statusNames ||
        !suggestions.statusColors ||
        !Array.isArray(suggestions.statusNames) ||
        !Array.isArray(suggestions.statusColors) ||
        suggestions.statusNames.length !== suggestions.statusColors.length
      ) {
        console.error("Invalid suggestions structure:", suggestions);
        return {
          spaceName: "New Space",
          projectName: "New Project",
          statusNames: ["Backlog", "To Do", "In Progress", "Review", "Done"],
          statusColors: ["gray", "cyan", "blue", "yellow", "green"],
          error: "AI returned incomplete suggestions. Using defaults.",
        };
      }

      // Validate status colors
      const validColors = [
        "red",
        "blue",
        "green",
        "yellow",
        "purple",
        "pink",
        "indigo",
        "orange",
        "teal",
        "cyan",
        "gray",
      ];
      suggestions.statusColors = suggestions.statusColors.map((color: string) => {
        const validColor = validColors.find(
          (c) => c === color.toLowerCase() || color.toLowerCase().includes(c)
        );
        return validColor || "gray";
      });

      return {
        spaceName: suggestions.spaceName,
        projectName: suggestions.projectName,
        statusNames: suggestions.statusNames,
        statusColors: suggestions.statusColors,
      };
    } catch (parseError) {
      console.error("Failed to parse AI suggestions response:", parseError);
      console.error("AI response text:", text);
      return {
        spaceName: "New Space",
        projectName: "New Project",
        statusNames: ["Backlog", "To Do", "In Progress", "Review", "Done"],
        statusColors: ["gray", "cyan", "blue", "yellow", "green"],
        error: "Failed to parse AI suggestions. Using defaults.",
      };
    }
  } catch (error) {
    console.error("Error generating project suggestions:", error);

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return {
          error:
            "Claude API key is invalid or missing. Please check your configuration.",
        };
      }
      if (error.message.includes("quota")) {
        return {
          error:
            "Claude API quota exceeded. Please check your Claude usage limits.",
        };
      }
    }

    return {
      spaceName: "New Space",
      projectName: "New Project",
      statusNames: ["Backlog", "To Do", "In Progress", "Review", "Done"],
      statusColors: ["gray", "cyan", "blue", "yellow", "green"],
      error: "Failed to generate suggestions.",
    };
  }
}

/**
 * Create a new space and project with AI-generated content
 * @param workspaceId The workspace ID
 * @param spaceName The name of the new space (empty string if using existing space)
 * @param projectName The name of the new project
 * @param statusNames Array of status names
 * @param statusColors Optional array of status colors
 * @param existingSpaceId The ID of an existing space to create the project in
 */
export async function createSpaceAndProject(
  workspaceId: string,
  spaceName: string,
  projectName: string,
  statusNames: string[],
  statusColors?: string[],
  existingSpaceId?: string
): Promise<{
  success: boolean;
  spaceId?: string;
  projectId?: string;
  error?: string;
}> {
  try {
    const supabase = await createServerSupabaseClient();

    // Get the current user
    const { user } = await getAuthUser(supabase);
    if (!user) {
      console.error("User not authenticated");
      return { success: false, error: "User not authenticated" };
    }

    // Get workspace UUID
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("workspace_id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      console.error("Workspace not found:", workspaceError);
      return { success: false, error: "Workspace not found" };
    }

    let spaceId: string | undefined;
    let spaceUuid: string | undefined;

    // If using existing space
    if (existingSpaceId && existingSpaceId.length > 0) {
      const { data: existingSpace, error: spaceError } = await supabase
        .from("spaces")
        .select("id, space_id")
        .eq("space_id", existingSpaceId)
        .eq("workspace_id", workspace.id)
        .single();

      if (spaceError || !existingSpace) {
        console.error("Existing space not found:", spaceError);
        return { success: false, error: "Existing space not found" };
      }

      spaceId = existingSpace.space_id;
      spaceUuid = existingSpace.id;
    }
    // Create new space
    else if (spaceName.length > 0) {
      const { data: newSpace, error: spaceError } = await supabase
        .from("spaces")
        .insert({
          name: spaceName,
          description: `Space for ${spaceName} related projects`,
          icon: "blue",
          is_private: false,
          workspace_id: workspace.id,
        })
        .select("id, space_id")
        .single();

      if (spaceError || !newSpace) {
        console.error("Failed to create space:", spaceError);
        return {
          success: false,
          error: `Failed to create space: ${spaceError?.message}`,
        };
      }

      // PHASE_5_NOOP: was multi-user space-member insert, OSS is single-user
      spaceId = newSpace.space_id;
      spaceUuid = newSpace.id;
    } else {
      console.error("Neither spaceName nor existingSpaceId provided");
      return {
        success: false,
        error: "Either spaceName or existingSpaceId must be provided",
      };
    }

    // Create project
    const { data: newProject, error: projectError } = await supabase
      .from("projects")
      .insert({
        name: projectName,
        space_id: spaceUuid,
        workspace_id: workspace.id,
      })
      .select("id, project_id")
      .single();

    if (projectError || !newProject) {
      console.error("Failed to create project:", projectError);
      return {
        success: false,
        error: `Failed to create project: ${projectError?.message}`,
      };
    }

    // Use centralized status service to prevent duplicates
    try {
      const existingStatuses = await getSpaceStatuses(supabase, spaceUuid!);

      if (!existingStatuses || existingStatuses.length === 0) {
        // Create statuses using the centralized service
        const customStatuses = statusNames.map((name, index) => ({
          name,
          color: statusColors?.[index] || getDefaultStatusColorName(index),
        }));

        await getOrCreateDefaultStatuses(
          supabase,
          spaceUuid!,
          workspace.id,
          customStatuses.length > 0 ? customStatuses : undefined
        );
      }
    } catch (statusError: any) {
      console.error("Failed to create statuses:", statusError);
      // Don't fail the entire operation - statuses are not critical for project creation
    }

    return {
      success: true,
      spaceId: spaceId,
      projectId: newProject.project_id,
    };
  } catch (error) {
    console.error("=== createSpaceAndProject ERROR ===", error);
    return {
      success: false,
      error: "Failed to create space and project",
    };
  }
}
