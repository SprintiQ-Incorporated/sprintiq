/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { SprintiQMCPClient, MCPClientManager } from "./client";
import {
  MCPClientConfig,
  MCPTool,
  MCPServerInfo,
  SprintiQContext,
  MCPToolResult,
  MCPUserValidationResult,
  MCPValidatedUser,
} from "./types";
import { mcpUserValidationService } from "./user-validation";
import { enhancedMCPService } from "./enhanced-service";

/**
 * MCP Integration Service for SprintiQ
 * Provides high-level interface for MCP operations with email-based user validation
 * Now includes enhanced workflow with proper connection management
 */
export class MCPService {
  private static instance: MCPService;
  private clientManager: MCPClientManager;
  private defaultContext: Partial<SprintiQContext> = {};

  private constructor() {
    this.clientManager = new MCPClientManager();
  }

  static getInstance(): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService();
    }
    return MCPService.instance;
  }

  /**
   * Enhanced workflow methods - NEW
   */

  /**
   * Check if user has active SprintiQ connection
   */
  async checkActiveConnection(userEmail: string) {
    return await enhancedMCPService.checkActiveConnection();
  }

  /**
   * Establish connection and validate user
   */
  async establishConnection(userEmail: string) {
    return await enhancedMCPService.establishConnection(userEmail);
  }

  /**
   * Handle workspace selection workflow
   */
  async handleWorkspaceSelection(userEmail: string, workspaceId?: string) {
    return await enhancedMCPService.handleWorkspaceSelection(
      userEmail,
      workspaceId
    );
  }

  /**
   * Select workspace by name or ID
   */
  async selectWorkspaceByName(userEmail: string, workspaceNameOrId: string) {
    return await enhancedMCPService.selectWorkspaceByName(
      userEmail,
      workspaceNameOrId
    );
  }

  /**
   * Handle team member selection workflow
   */
  async handleTeamMemberSelection(
    userEmail: string,
    selectedTeamMemberIds?: string[]
  ) {
    return await enhancedMCPService.handleTeamMemberSelection(
      userEmail,
      selectedTeamMemberIds
    );
  }

  /**
   * Execute tool with proper workflow (main method)
   */
  async executeToolWithWorkflow(
    userEmail: string,
    toolName: string,
    params: any,
    workspaceId?: string,
    selectedTeamMemberIds?: string[]
  ) {
    return await enhancedMCPService.executeToolWithWorkflow(
      userEmail,
      toolName,
      params,
      workspaceId,
      selectedTeamMemberIds
    );
  }

  /**
   * Handle post-execution choice for story generation
   */
  async handlePostExecutionChoice(
    userEmail: string,
    choice: "saveAsStoriesOnly" | "saveWithSprints",
    storyData: any,
    options?: any
  ) {
    return await enhancedMCPService.handlePostExecutionChoice(
      userEmail,
      choice,
      storyData,
      options
    );
  }

  /**
   * Disconnect user session
   */
  async disconnectUser(userEmail: string) {
    return await enhancedMCPService.disconnectUser(userEmail);
  }

  /**
   * Validate user by email and get their context
   */
  async validateUserByEmail(email: string): Promise<MCPUserValidationResult> {
    return await mcpUserValidationService.validateUserByEmail(email);
  }

  /**
   * Create SprintiQ context from validated user
   */
  createSprintiQContext(
    validatedUser: MCPValidatedUser,
    workspaceId?: string,
    projectId?: string,
    sprintId?: string,
    teamId?: string
  ): SprintiQContext {
    return mcpUserValidationService.createSprintiQContext(
      validatedUser,
      workspaceId,
      projectId,
      sprintId,
      teamId
    );
  }

  /**
   * Validate user and create context in one step
   */
  async validateUserAndCreateContext(
    email: string,
    workspaceId?: string,
    projectId?: string,
    sprintId?: string,
    teamId?: string
  ): Promise<{ context: SprintiQContext | null; error?: string }> {
    const validation = await this.validateUserByEmail(email);

    if (!validation.isValid || !validation.user) {
      return {
        context: null,
        error: validation.error || "User validation failed",
      };
    }

    try {
      const context = this.createSprintiQContext(
        validation.user,
        workspaceId,
        projectId,
        sprintId,
        teamId
      );
      return { context };
    } catch (error) {
      return {
        context: null,
        error:
          error instanceof Error ? error.message : "Failed to create context",
      };
    }
  }

  /**
   * Set default context for all MCP operations
   */
  setDefaultContext(context: Partial<SprintiQContext>) {
    this.defaultContext = context;
  }

  /**
   * Connect to an external MCP server
   */
  async connectToServer(name: string, config: MCPClientConfig): Promise<void> {
    try {
      await this.clientManager.addClient(name, config);
    } catch (error) {
      console.error(`Failed to connect to MCP server ${name}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnectFromServer(name: string): Promise<void> {
    await this.clientManager.removeClient(name);
  }

  /**
   * List all connected MCP servers
   */
  getConnectedServers(): string[] {
    return this.clientManager.listClients();
  }

  /**
   * Get available tools from all connected servers
   */
  async getAllAvailableTools(): Promise<{ [serverName: string]: MCPTool[] }> {
    const servers = this.getConnectedServers();
    const toolsMap: { [serverName: string]: MCPTool[] } = {};

    for (const serverName of servers) {
      try {
        const tools = await this.clientManager.listToolsFromClient(serverName);
        toolsMap[serverName] = tools;
      } catch (error) {
        console.error(`Failed to get tools from server ${serverName}:`, error);
        toolsMap[serverName] = [];
      }
    }

    return toolsMap;
  }

  /**
   * Call a tool on a specific server with email-based validation
   */
  async callToolWithEmail(
    serverName: string,
    toolName: string,
    params: any,
    userEmail: string,
    workspaceId?: string,
    projectId?: string,
    sprintId?: string,
    teamId?: string
  ): Promise<MCPToolResult> {
    // Validate user and create context
    const { context, error } = await this.validateUserAndCreateContext(
      userEmail,
      workspaceId,
      projectId,
      sprintId,
      teamId
    );

    if (!context) {
      return {
        success: false,
        error: error || "Failed to validate user",
        metadata: {
          server: serverName,
          tool: toolName,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Call the tool with the validated context
    return await this.callTool(serverName, toolName, params, context);
  }

  /**
   * Call a tool on a specific server (internal method)
   */
  async callTool(
    serverName: string,
    toolName: string,
    params: any,
    contextOverride?: Partial<SprintiQContext>
  ): Promise<MCPToolResult> {
    const context = { ...this.defaultContext, ...contextOverride };

    if (!context.workspaceId || !context.userId) {
      throw new Error("Context must include workspaceId and userId");
    }

    const fullParams = {
      ...params,
      context: context,
    };

    try {
      const result = await this.clientManager.callToolOnClient(
        serverName,
        toolName,
        fullParams
      );
      return {
        success: true,
        data: result,
        metadata: {
          server: serverName,
          tool: toolName,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          server: serverName,
          tool: toolName,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Search for tools across all connected servers
   */
  async searchTools(
    query: string
  ): Promise<{ server: string; tool: MCPTool }[]> {
    const allTools = await this.getAllAvailableTools();
    const results: { server: string; tool: MCPTool }[] = [];

    for (const [serverName, tools] of Object.entries(allTools)) {
      for (const tool of tools) {
        if (
          tool.name.toLowerCase().includes(query.toLowerCase()) ||
          tool.description.toLowerCase().includes(query.toLowerCase())
        ) {
          results.push({ server: serverName, tool });
        }
      }
    }

    return results;
  }

  /**
   * Enhanced AI Story Generation using MCP with email validation
   */
  async generateStoriesWithMCPAndEmail(params: {
    featureDescription: string;
    numberOfStories?: number;
    complexity?: "simple" | "moderate" | "complex";
    externalSources?: string[];
    userEmail: string;
    workspaceId?: string;
    projectId?: string;
    sprintId?: string;
  }): Promise<MCPToolResult> {
    const { userEmail, workspaceId, projectId, sprintId, ...mcpParams } =
      params;

    // Use enhanced workflow for story generation
    return await enhancedMCPService.executeToolWithWorkflow(
      userEmail,
      "SPRINTIQ_GENERATE_USER_STORIES",
      mcpParams,
      workspaceId
    );
  }

  /**
   * Enhanced Task Priority Analysis using MCP with email validation
   */
  async analyzeTaskPriorityWithMCPAndEmail(params: {
    taskIds: string[];
    priorityWeights?: any;
    externalFactors?: any;
    userEmail: string;
    workspaceId?: string;
    projectId?: string;
    sprintId?: string;
  }): Promise<MCPToolResult> {
    const { userEmail, workspaceId, projectId, sprintId, ...mcpParams } =
      params;

    // Use enhanced workflow for task priority analysis
    return await enhancedMCPService.executeToolWithWorkflow(
      userEmail,
      "analyzeTaskPriority",
      mcpParams,
      workspaceId
    );
  }

  /**
   * Multi-source Similar Task Search using MCP with email validation
   */
  async findSimilarTasksWithMCPAndEmail(params: {
    query: string;
    sources?: string[];
    limit?: number;
    userEmail: string;
    workspaceId?: string;
    projectId?: string;
    sprintId?: string;
  }): Promise<MCPToolResult[]> {
    const { userEmail, workspaceId, projectId, sprintId, ...mcpParams } =
      params;

    // Use enhanced workflow for similar task search
    try {
      const result = await enhancedMCPService.executeToolWithWorkflow(
        userEmail,
        "SPRINTIQ_FIND_SIMILAR_TASKS",
        mcpParams,
        workspaceId
      );
      return [result];
    } catch (error) {
      console.error("Failed to search similar tasks:", error);
      return [];
    }
  }

  /**
   * Enhanced Team Assignment using MCP with email validation
   */
  async getOptimalTeamAssignmentWithMCPAndEmail(params: {
    taskId: string;
    skills?: string[];
    workload?: any;
    userEmail: string;
    workspaceId?: string;
    projectId?: string;
    sprintId?: string;
    teamId?: string;
  }): Promise<MCPToolResult> {
    const {
      userEmail,
      workspaceId,
      projectId,
      sprintId,
      teamId,
      ...mcpParams
    } = params;

    // Use enhanced workflow for team assignment
    return await enhancedMCPService.executeToolWithWorkflow(
      userEmail,
      "assignTask",
      mcpParams,
      workspaceId
    );
  }

  /**
   * Cross-platform Analytics using MCP with email validation
   */
  async getCrossplatformAnalyticsWithEmail(params: {
    type: "project" | "sprint" | "team";
    id: string;
    sources?: string[];
    userEmail: string;
    workspaceId?: string;
    projectId?: string;
    sprintId?: string;
    teamId?: string;
  }): Promise<MCPToolResult[]> {
    const {
      userEmail,
      workspaceId,
      projectId,
      sprintId,
      teamId,
      ...mcpParams
    } = params;

    const analyticsTools = await this.searchTools("analytics");
    const results: MCPToolResult[] = [];

    // Get analytics from all available sources
    for (const { server, tool } of analyticsTools) {
      try {
        const result = await this.callToolWithEmail(
          server,
          tool.name,
          mcpParams,
          userEmail,
          workspaceId,
          projectId,
          sprintId,
          teamId
        );
        results.push(result);
      } catch (error) {
        console.error(`Failed to get analytics from server ${server}:`, error);
      }
    }

    // Include internal analytics
    try {
      const toolName = `get${
        params.type.charAt(0).toUpperCase() + params.type.slice(1)
      }Analytics`;
      const internalResult = await this.callToolWithEmail(
        "internal",
        toolName,
        mcpParams,
        userEmail,
        workspaceId,
        projectId,
        sprintId,
        teamId
      );
      results.push(internalResult);
    } catch (error) {
      console.error("Failed to get internal analytics:", error);
    }

    return results;
  }

  /**
   * Batch tool execution across multiple servers with email validation
   */
  async executeBatchOperationsWithEmail(
    operations: {
      server: string;
      tool: string;
      params: any;
    }[],
    userEmail: string,
    workspaceId?: string,
    projectId?: string,
    sprintId?: string,
    teamId?: string
  ): Promise<MCPToolResult[]> {
    // First validate the user and create context
    const { context, error } = await this.validateUserAndCreateContext(
      userEmail,
      workspaceId,
      projectId,
      sprintId,
      teamId
    );

    if (!context) {
      return [
        {
          success: false,
          error: error || "Failed to validate user",
          metadata: {
            timestamp: new Date().toISOString(),
          },
        },
      ];
    }

    const results: MCPToolResult[] = [];

    // Execute operations in parallel
    const promises = operations.map(async (operation) => {
      try {
        return await this.callTool(
          operation.server,
          operation.tool,
          operation.params,
          context
        );
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          metadata: {
            server: operation.server,
            tool: operation.tool,
            timestamp: new Date().toISOString(),
          },
        };
      }
    });

    const batchResults = await Promise.allSettled(promises);

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          success: false,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : "Unknown error",
        });
      }
    }

    return results;
  }

  /**
   * Get server info from a specific client
   */
  async getServerInfoFromClient(clientName: string): Promise<MCPServerInfo> {
    return await this.clientManager.getServerInfoFromClient(clientName);
  }

  /**
   * List tools from a specific client
   */
  async listToolsFromClient(clientName: string): Promise<MCPTool[]> {
    return await this.clientManager.listToolsFromClient(clientName);
  }

  /**
   * Health check for all connected servers
   */
  async healthCheck(): Promise<{ [serverName: string]: boolean }> {
    const servers = this.getConnectedServers();
    const healthStatus: { [serverName: string]: boolean } = {};

    for (const serverName of servers) {
      try {
        await this.clientManager.getServerInfoFromClient(serverName);
        healthStatus[serverName] = true;
      } catch (error) {
        healthStatus[serverName] = false;
        console.error(`Health check failed for server ${serverName}:`, error);
      }
    }

    return healthStatus;
  }

  /**
   * Disconnect all clients and cleanup
   */
  async cleanup(): Promise<void> {
    await this.clientManager.disconnectAll();
  }
}

// Export singleton instance
export const mcpService = MCPService.getInstance();
