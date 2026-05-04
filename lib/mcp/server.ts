/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  MCPServer,
  MCPServerInfo,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPToolResult,
  SprintiQContext,
  MCPError,
} from "./types";

/** Chat-style prompt message returned by getPrompt methods */
interface PromptMessage {
  role: string;
  content: {
    type: string;
    text: string;
  };
}

// Dynamic import helper to avoid bundling "use server" files into API routes
async function getAiActions() {
  return await import("@/app/[workspaceId]/actions");
}
import { SprintCreationService } from "@/lib/sprint-creation-service";
import { DEFAULT_WEIGHTS } from "@/types";
import { enhancedMCPService } from "./enhanced-service";

export class SprintiQMCPServer implements MCPServer {
  private serverInfo: MCPServerInfo;
  private tools: MCPTool[];
  private resources: MCPResource[];
  private prompts: MCPPrompt[];

  constructor() {
    this.serverInfo = {
      name: "SprintiQ MCP Server",
      version: "1.0.0",
      capabilities: [],
    };

    this.tools = this.initializeTools();
    this.resources = this.initializeResources();
    this.prompts = this.initializePrompts();
  }

  info(): MCPServerInfo {
    return this.serverInfo;
  }

  listTools(): MCPTool[] {
    return this.tools;
  }

  listResources(): MCPResource[] {
    return this.resources;
  }

  listPrompts(): MCPPrompt[] {
    return this.prompts;
  }

  private initializeTools(): MCPTool[] {
    return [
      {
        name: "generate_user_stories",
        description:
          "Generate user stories based on a feature description using TAWOS patterns",
        inputSchema: {
          type: "object",
          properties: {
            feature_description: {
              type: "string",
              description: "Description of the feature to generate stories for",
            },
            number_of_stories: {
              type: "number",
              description: "Number of stories to generate (default: 3)",
              default: 3,
            },
            complexity: {
              type: "string",
              enum: ["simple", "moderate", "complex"],
              description: "Complexity level of the stories",
              default: "moderate",
            },
          },
          required: ["feature_description"],
        },
      },
      {
        name: "find_similar_tasks",
        description:
          "Find tasks similar to a given description using vector search",
        inputSchema: {
          type: "object",
          properties: {
            description: {
              type: "string",
              description: "Description to find similar tasks for",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 5)",
              default: 5,
            },
          },
          required: ["description"],
        },
      },
      {
        name: "get_workspace_metrics",
        description: "Get metrics for the current workspace",
        inputSchema: {
          type: "object",
          properties: {
            include_velocity: {
              type: "boolean",
              description: "Include velocity metrics",
              default: true,
            },
            include_health: {
              type: "boolean",
              description: "Include health score metrics",
              default: true,
            },
          },
        },
      },
      {
        name: "list_sprints",
        description: "List sprints in the current workspace",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["active", "completed", "planned", "all"],
              description: "Filter by sprint status",
              default: "all",
            },
            limit: {
              type: "number",
              description: "Maximum number of sprints to return",
              default: 10,
            },
          },
        },
      },
      {
        name: "create_task",
        description: "Create a new task in the workspace",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Task title",
            },
            description: {
              type: "string",
              description: "Task description",
            },
            project_id: {
              type: "string",
              description: "Project ID to add the task to",
            },
            sprint_id: {
              type: "string",
              description: "Optional sprint ID to add the task to",
            },
            assignee_id: {
              type: "string",
              description: "Optional user ID to assign the task to",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "urgent"],
              description: "Task priority",
              default: "medium",
            },
          },
          required: ["title", "project_id"],
        },
      },
      {
        name: "get_team_recommendations",
        description:
          "Get AI-powered team assignment recommendations for a task or story",
        inputSchema: {
          type: "object",
          properties: {
            task_description: {
              type: "string",
              description: "Description of the task or story",
            },
            required_skills: {
              type: "array",
              items: { type: "string" },
              description: "List of required skills",
            },
            estimated_hours: {
              type: "number",
              description: "Estimated hours for completion",
            },
          },
          required: ["task_description"],
        },
      },
    ];
  }

  private initializeResources(): MCPResource[] {
    return [
      {
        uri: "sprintiq://workspace/current",
        name: "Current Workspace",
        description: "Information about the current workspace",
        mimeType: "application/json",
      },
      {
        uri: "sprintiq://sprints/active",
        name: "Active Sprints",
        description: "List of active sprints in the workspace",
        mimeType: "application/json",
      },
      {
        uri: "sprintiq://team/members",
        name: "Team Members",
        description: "List of team members in the workspace",
        mimeType: "application/json",
      },
      {
        uri: "sprintiq://projects/list",
        name: "Projects",
        description: "List of projects in the workspace",
        mimeType: "application/json",
      },
    ];
  }

  private initializePrompts(): MCPPrompt[] {
    return [
      {
        name: "sprint_planning",
        description: "Help plan a new sprint based on backlog items",
        arguments: [
          {
            name: "sprint_goal",
            description: "The goal for the sprint",
            required: true,
          },
          {
            name: "team_capacity",
            description: "Available team capacity in story points",
            required: false,
          },
        ],
      },
      {
        name: "story_refinement",
        description: "Help refine and improve user stories",
        arguments: [
          {
            name: "story_title",
            description: "Title of the story to refine",
            required: true,
          },
          {
            name: "current_description",
            description: "Current story description",
            required: false,
          },
        ],
      },
      {
        name: "retrospective",
        description: "Generate retrospective insights for a completed sprint",
        arguments: [
          {
            name: "sprint_id",
            description: "ID of the completed sprint",
            required: true,
          },
        ],
      },
    ];
  }

  async callTool(
    toolName: string,
    params: any,
    context?: SprintiQContext
  ): Promise<MCPToolResult> {
    switch (toolName) {
      case "generate_user_stories":
        return this.generateUserStories(params, context);
      case "find_similar_tasks":
        return this.findSimilarTasks(params, context);
      case "get_workspace_metrics":
        return this.getWorkspaceMetrics(params, context);
      case "list_sprints":
        return this.listSprints(params, context);
      case "create_task":
        return this.createTask(params, context);
      case "get_team_recommendations":
        return this.getTeamRecommendations(params, context);
      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
        };
    }
  }

  async readResource(
    uri: string,
    context?: SprintiQContext
  ): Promise<MCPToolResult> {
    const supabase = await createServerSupabaseClient();

    switch (uri) {
      case "sprintiq://workspace/current":
        return this.getCurrentWorkspace(supabase, context);
      case "sprintiq://sprints/active":
        return this.getActiveSprints(supabase, context);
      case "sprintiq://team/members":
        return this.getTeamMembers(supabase, context);
      case "sprintiq://projects/list":
        return this.getProjects(supabase, context);
      default:
        return {
          success: false,
          error: `Unknown resource: ${uri}`,
        };
    }
  }

  async getPrompt(
    promptName: string,
    args?: Record<string, string>,
    context?: SprintiQContext
  ): Promise<PromptMessage[]> {
    const promptArgs = args || {};
    switch (promptName) {
      case "sprint_planning":
        return this.getSprintPlanningPrompt(promptArgs, context);
      case "story_refinement":
        return this.getStoryRefinementPrompt(promptArgs, context);
      case "retrospective":
        return this.getRetrospectivePrompt(promptArgs, context);
      default:
        return [
          {
            role: "user",
            content: {
              type: "text",
              text: `Unknown prompt: ${promptName}`,
            },
          },
        ];
    }
  }

  // Tool implementations
  private async generateUserStories(
    params: any,
    context?: SprintiQContext
  ): Promise<MCPToolResult> {
    try {
      const storyParams = {
        featureDescription: params.feature_description,
        numberOfStories: params.number_of_stories || 3,
        complexity: params.complexity || "moderate",
        priorityWeights: DEFAULT_WEIGHTS,
        workspaceId: context?.workspaceId ?? "",
        useTAWOS: true,
      };

      const { generateTAWOSStories } = await getAiActions();
      const result = await generateTAWOSStories(storyParams);

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate user stories",
      };
    }
  }

  private async findSimilarTasks(
    params: any,
    context?: SprintiQContext
  ): Promise<MCPToolResult> {
    try {
      // Since findSimilarTasksWithAI doesn't exist, we'll create a basic implementation
      const supabase = await createServerSupabaseClient();

      const { data: tasks, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("workspace_id", context?.workspaceId ?? "")
        .is("deleted_at", null)
        .textSearch("name", params.description, {
          type: "websearch",
          config: "english",
        })
        .limit(params.limit || 5);

      if (error) throw error;

      return {
        success: true,
        data: {
          similar_tasks: tasks || [],
          count: tasks?.length || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to find similar tasks",
      };
    }
  }

  private async getWorkspaceMetrics(
    params: any,
    context?: SprintiQContext
  ): Promise<MCPToolResult> {
    try {
      const supabase = await createServerSupabaseClient();
      const metrics: any = {};

      // Get task counts
      const { count: totalTasks } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", context?.workspaceId ?? "")
        .is("deleted_at", null);

      const { count: completedTasks } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", context?.workspaceId ?? "")
        .is("deleted_at", null)
        .eq("status", "completed");

      metrics.tasks = {
        total: totalTasks || 0,
        completed: completedTasks || 0,
        completion_rate:
          totalTasks && totalTasks > 0
            ? ((completedTasks || 0) / totalTasks) * 100
            : 0,
      };

      if (params.include_velocity) {
        // Get sprint velocity (simplified)
        const { data: recentSprints } = await supabase
          .from("sprints")
          .select("*")
          .eq("workspace_id", context?.workspaceId ?? "")
          .order("end_date", { ascending: false })
          .limit(5);

        metrics.velocity = {
          recent_sprints: recentSprints?.length || 0,
          // Add more velocity metrics as needed
        };
      }

      if (params.include_health) {
        metrics.health = {
          score: 75, // Placeholder - would need actual calculation
          factors: {
            task_completion: metrics.tasks.completion_rate,
            // Add more health factors
          },
        };
      }

      return { success: true, data: metrics };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get workspace metrics",
      };
    }
  }

  private async listSprints(
    params: any,
    context?: SprintiQContext
  ): Promise<MCPToolResult> {
    try {
      const supabase = await createServerSupabaseClient();

      let query = supabase
        .from("sprints")
        .select("*")
        .eq("workspace_id", context?.workspaceId ?? "")
        .order("start_date", { ascending: false })
        .limit(params.limit || 10);

      if (params.status && params.status !== "all") {
        query = query.eq("status", params.status);
      }

      const { data: sprints, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: {
          sprints: sprints || [],
          count: sprints?.length || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to list sprints",
      };
    }
  }

  private async createTask(
    params: any,
    context?: SprintiQContext
  ): Promise<MCPToolResult> {
    try {
      const supabase = await createServerSupabaseClient();

      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          name: params.title,
          description: params.description,
          project_id: params.project_id,
          sprint_id: params.sprint_id,
          assignee_id: params.assignee_id,
          priority: params.priority || "medium",
          workspace_id: context?.workspaceId ?? "",
          created_by: context?.userId ?? "",
          status_id: params.status_id || "todo",
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: { task },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create task",
      };
    }
  }

  // PHASE_5_NOOP: was multi-user team-recommendation engine, OSS is single-user
  private async getTeamRecommendations(
    _params: any,
    _context?: SprintiQContext
  ): Promise<MCPToolResult> {
    return {
      success: true,
      data: { recommendations: [] },
    };
  }

  // Resource implementations
  private async getCurrentWorkspace(
    supabase: any,
    context?: SprintiQContext
  ): Promise<MCPToolResult> {
    try {
      const { data: workspace, error } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", context?.workspaceId ?? "")
        .single();

      if (error) throw error;

      return { success: true, data: workspace };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get current workspace",
      };
    }
  }

  private async getActiveSprints(
    supabase: any,
    context?: SprintiQContext
  ): Promise<MCPToolResult> {
    try {
      const { data: sprints, error } = await supabase
        .from("sprints")
        .select("*")
        .eq("workspace_id", context?.workspaceId ?? "")
        .eq("status", "active");

      if (error) throw error;

      return { success: true, data: sprints || [] };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get active sprints",
      };
    }
  }

  // PHASE_5_NOOP: was multi-user team-member listing, OSS is single-user
  private async getTeamMembers(
    _supabase: any,
    _context?: SprintiQContext
  ): Promise<MCPToolResult> {
    return { success: true, data: [] };
  }

  private async getProjects(
    supabase: any,
    context?: SprintiQContext
  ): Promise<MCPToolResult> {
    try {
      const { data: projects, error } = await supabase
        .from("projects")
        .select("*")
        .eq("workspace_id", context?.workspaceId ?? "")
        .is("deleted_at", null);

      if (error) throw error;

      return { success: true, data: projects || [] };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get projects",
      };
    }
  }

  // Prompt implementations
  private async getSprintPlanningPrompt(
    args: Record<string, string>,
    context?: SprintiQContext
  ): Promise<PromptMessage[]> {
    const supabase = await createServerSupabaseClient();

    // Get backlog items
    const { data: backlogItems } = await supabase
      .from("tasks")
      .select("*")
      .eq("workspace_id", context?.workspaceId ?? "")
      .is("sprint_id", null)
      .is("deleted_at", null)
      .limit(20);

    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Help me plan a sprint with the following goal: "${args.sprint_goal}"

Team capacity: ${args.team_capacity || "Not specified"} story points

Available backlog items:
${JSON.stringify(backlogItems || [], null, 2)}

Please recommend which items to include in the sprint and provide a suggested sprint plan.`,
        },
      },
    ];
  }

  private async getStoryRefinementPrompt(
    args: Record<string, string>,
    context?: SprintiQContext
  ): Promise<PromptMessage[]> {
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Help me refine the following user story:

Title: ${args.story_title}
Current Description: ${args.current_description || "No description provided"}

Please suggest improvements for:
1. Clarity of acceptance criteria
2. Story point estimation
3. Potential risks or blockers
4. Breaking down into smaller tasks if needed`,
        },
      },
    ];
  }

  private async getRetrospectivePrompt(
    args: Record<string, string>,
    context?: SprintiQContext
  ): Promise<PromptMessage[]> {
    const supabase = await createServerSupabaseClient();

    // Get sprint data
    const { data: sprint } = await supabase
      .from("sprints")
      .select("*")
      .eq("id", args.sprint_id)
      .single();

    // Get tasks from sprint
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("sprint_id", args.sprint_id);

    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Generate retrospective insights for the following sprint:

Sprint: ${JSON.stringify(sprint, null, 2)}

Tasks completed: ${tasks?.filter((t: any) => t.status_id === "completed").length || 0}
Tasks incomplete: ${tasks?.filter((t: any) => t.status_id !== "completed").length || 0}

Please provide:
1. What went well
2. What could be improved
3. Action items for next sprint
4. Team velocity analysis`,
        },
      },
    ];
  }
}

// Export singleton instance
export const sprintiQMCPServer = new SprintiQMCPServer();
