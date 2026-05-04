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
  MCPWorkspaceInfo,
  MCPTeamInfo,
} from "./types";
import { mcpUserValidationService } from "./user-validation";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database-aliases";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

// Dynamic import helper to avoid bundling "use server" files into API routes
async function getAiActions() {
  return await import("@/app/[workspaceId]/actions");
}

export interface MCPConnectionStatus {
  isConnected: boolean;
  hasActiveConnection: boolean;
  connectionId?: string;
  establishedAt?: Date;
  lastActivity?: Date;
  requiresAuthorization?: boolean;
  authorizationUrl?: string;
  authToken?: string;
  error?: string;
}

export interface MCPAuthorizationInfo {
  isRequired: boolean;
  authorizationUrl?: string;
  message?: string;
  redirectUrl?: string;
}

export interface MCPWorkspaceSelection {
  workspaces: MCPWorkspaceInfo[];
  selectedWorkspace?: MCPWorkspaceInfo;
  requiresSelection: boolean;
}

export interface MCPTeamMemberSelection {
  teamMembers: MCPTeamInfo[];
  selectedMembers?: MCPTeamInfo[];
  requiresSelection: boolean;
}

export interface MCPStoryGenerationResult {
  stories: any[];
  metadata: {
    workspaceId: string;
    projectId?: string;
    teamMembers?: MCPTeamInfo[];
    generatedAt: Date;
  };
}

export interface MCPPostExecutionOptions {
  saveAsStoriesOnly: boolean;
  saveWithSprints: boolean;
  createSprintFolder?: boolean;
  sprintDuration?: number;
}

/**
 * Enhanced MCP Service with proper workflow implementation
 */
export class EnhancedMCPService {
  private static instance: EnhancedMCPService;
  private clientManager: MCPClientManager;
  private activeConnections: Map<string, MCPConnectionStatus> = new Map();
  // Remove the in-memory userSessions Map - we'll use database storage instead

  // Lazy: resolved on first access so the build can collect page data without
  // crashing when NEXT_PUBLIC_APP_URL isn't set in the build environment.
  // Runtime callers still throw loudly if it's unset in production.
  private get APP_BASE_URL(): string {
    const url = process.env.NEXT_PUBLIC_APP_URL;
    if (!url) {
      throw new Error("NEXT_PUBLIC_APP_URL is required for MCP OAuth callbacks");
    }
    return url;
  }
  private get MCP_CALLBACK_URL(): string {
    return `${this.APP_BASE_URL}/api/mcp/auth/callback`;
  }

  private constructor() {
    this.clientManager = new MCPClientManager();

    // Clean up expired auth attempts every 5 minutes
    setInterval(() => this.cleanupExpiredAuth(), 5 * 60 * 1000);
  }

  /**
   * Store pending authentication in database instead of memory
   */
  private async storePendingAuth(
    token: string,
    email: string = ""
  ): Promise<void> {
    try {
      const supabase = createAdminClient();

      // Store in database with 10 minute expiry
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await supabase.from("mcp_auth_tokens").upsert({
        token,
        email,
        status: "pending",
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      });

    } catch (error) {
      console.error("[MCP] Failed to store pending auth token:", error);
      throw error;
    }
  }

  /**
   * Get pending authentication from database
   */
  private async getPendingAuth(token: string): Promise<{
    email: string;
    token: string;
    createdAt: Date;
    status: "pending" | "completed" | "failed";
  } | null> {
    try {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from("mcp_auth_tokens")
        .select("*")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return {
        email: data.email || "",
        token: data.token,
        createdAt: new Date(data.created_at!),
        status: data.status as "pending" | "completed" | "failed",
      };
    } catch (error) {
      console.error("[MCP] Failed to get pending auth token:", error);
      return null;
    }
  }

  /**
   * Update pending authentication in database
   */
  async updatePendingAuth(
    token: string,
    updates: {
      email?: string;
      status?: "pending" | "completed" | "failed";
    }
  ): Promise<void> {
    try {
      const supabase = createAdminClient();

      await supabase.from("mcp_auth_tokens").update(updates).eq("token", token);

    } catch (error) {
      console.error("[MCP] Failed to update pending auth token:", error);
      throw error;
    }
  }

  /**
   * Clean up expired authentication tokens and sessions from database
   */
  private async cleanupExpiredAuth(): Promise<void> {
    try {
      const supabase = createAdminClient();

      const { error } = await supabase
        .from("mcp_auth_tokens")
        .delete()
        .lt("expires_at", new Date().toISOString());

      if (error) {
        console.error("[MCP] Failed to cleanup expired auth tokens:", error);
      } else {
      }
    } catch (error) {
      console.error("[MCP] Error during auth token cleanup:", error);
    }
  }

  /**
   * Generate authentication token for Cursor flow
   */
  private generateAuthToken(): string {
    return `mcp_auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Store user session in database
   */
  private async storeUserSession(
    userEmail: string,
    sessionData: {
      user: MCPValidatedUser;
      workspace?: MCPWorkspaceInfo;
      teamMembers?: MCPTeamInfo[];
      connectionId: string;
    }
  ): Promise<void> {
    try {
      const supabase = createAdminClient();

      // Store session data with 24 hour expiry
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await supabase.from("mcp_auth_tokens").upsert({
        token: `session_${userEmail}`,
        email: userEmail,
        status: "active_session",
        session_data: JSON.stringify(sessionData),
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      });

    } catch (error) {
      console.error("[MCP] Failed to store user session:", error);
      throw error;
    }
  }

  /**
   * Get user session from database
   */
  private async getUserSession(userEmail: string): Promise<{
    user: MCPValidatedUser;
    workspace?: MCPWorkspaceInfo;
    teamMembers?: MCPTeamInfo[];
    connectionId: string;
  } | null> {
    try {
      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from("mcp_auth_tokens")
        .select("session_data")
        .eq("token", `session_${userEmail}`)
        .eq("status", "active_session")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (error || !data || !data.session_data) {
        return null;
      }

      return JSON.parse(String(data.session_data));
    } catch (error) {
      console.error("[MCP] Failed to get user session:", error);
      return null;
    }
  }

  /**
   * Update user session in database
   */
  private async updateUserSession(
    userEmail: string,
    updates: Partial<{
      workspace: MCPWorkspaceInfo;
      teamMembers: MCPTeamInfo[];
    }>
  ): Promise<void> {
    try {
      const currentSession = await this.getUserSession(userEmail);
      if (!currentSession) {
        throw new Error("No active session found to update");
      }

      const updatedSession = {
        ...currentSession,
        ...updates,
      };

      await this.storeUserSession(userEmail, updatedSession);
    } catch (error) {
      console.error("[MCP] Failed to update user session:", error);
      throw error;
    }
  }

  static getInstance(): EnhancedMCPService {
    if (!EnhancedMCPService.instance) {
      EnhancedMCPService.instance = new EnhancedMCPService();
    }
    return EnhancedMCPService.instance;
  }

  /**
   * Check authentication status by token (for Cursor polling)
   */
  async checkAuthenticationStatus(token: string): Promise<{
    status: "pending" | "completed" | "failed" | "expired";
    email?: string;
    error?: string;
  }> {

    const authData = await this.getPendingAuth(token);

    if (!authData) {
      return {
        status: "expired",
        error: "Authentication token not found or expired",
      };
    }

    const age = new Date().getTime() - authData.createdAt.getTime();

    if (age > 10 * 60 * 1000) {
      // 10 minutes expiry - this should be handled by database query but double-check
      return { status: "expired", error: "Authentication token expired" };
    }
    return {
      status: authData.status,
      email: authData.email,
    };
  }

  /**
   * Complete authentication (called by callback)
   */
  async completeAuthentication(
    token: string,
    userEmail: string
  ): Promise<{
    success: boolean;
    email?: string;
    error?: string;
  }> {

    const authData = await this.getPendingAuth(token);

    if (!authData) {
      return { success: false, error: "Authentication token not found" };
    }

    // Update with the actual user email from the session
    await this.updatePendingAuth(token, {
      email: userEmail,
      status: "completed",
    });
    return {
      success: true,
      email: userEmail,
    };
  }

  /**
   * Get completed authentication (for checking if user is authenticated)
   */
  async getCompletedAuthentication(): Promise<{
    success: boolean;
    email?: string;
    token?: string;
    error?: string;
  }> {
    try {
      const supabase = createAdminClient();

      // Find the most recent completed authentication
      const { data, error } = await supabase
        .from("mcp_auth_tokens")
        .select("*")
        .eq("status", "completed")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[MCP] Error getting completed authentication:", error);
        return {
          success: false,
          error: "Failed to get completed authentication",
        };
      }

      if (data && data.email) {
        return {
          success: true,
          email: data.email,
          token: data.token,
        };
      }

      return {
        success: false,
        error: "No completed authentication found",
      };
    } catch (error) {
      console.error("[MCP] Error in getCompletedAuthentication:", error);
      return {
        success: false,
        error: "Failed to get completed authentication",
      };
    }
  }

  /**
   * Step 1: Check active connection - SPRINTIQ_CHECK_ACTIVE_CONNECTION
   * Simplified to handle only redirect flow
   */
  async checkActiveConnection(): Promise<MCPConnectionStatus> {
    try {
      // Generate auth token for the redirect flow
      const authToken = this.generateAuthToken();

      // Store pending auth without email (will be filled after redirect)
      await this.storePendingAuth(authToken, "");


      // Return redirect URL for SprintIQ signin
      return {
        isConnected: false,
        hasActiveConnection: false,
        requiresAuthorization: true,
        authorizationUrl: `${
          this.APP_BASE_URL
        }/signin?mcp_token=${authToken}&redirect=${encodeURIComponent(
          this.MCP_CALLBACK_URL
        )}`,
        authToken: authToken,
        error:
          "Authentication required. Please sign in to SprintIQ using the provided URL.",
      };
    } catch (error) {
      console.error("Error in checkActiveConnection:", error);
      return {
        isConnected: false,
        hasActiveConnection: false,
        requiresAuthorization: true,
        error: "Failed to generate authentication URL",
      };
    }
  }

  /**
   * Check if user is authenticated in the main SprintIQ app
   */
  private async checkUserAuthentication(userEmail: string): Promise<{
    isAuthenticated: boolean;
    authorizationUrl?: string;
    authToken?: string;
    error?: string;
  }> {
    try {
      const supabase = await createServerSupabaseClient();

      // Check if user exists in profiles table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, company")
        .eq("email", userEmail.toLowerCase().trim())
        .maybeSingle();

      if (profileError) {
        const authToken = this.generateAuthToken();
        await this.storePendingAuth(authToken, userEmail);

        return {
          isAuthenticated: false,
          authorizationUrl: `${
            this.APP_BASE_URL
          }/signin?mcp_token=${authToken}&redirect=${encodeURIComponent(
            this.MCP_CALLBACK_URL
          )}`,
          authToken: authToken,
          error: "Failed to verify user authentication",
        };
      }

      if (!profile) {
        const authToken = this.generateAuthToken();
        await this.storePendingAuth(authToken, userEmail);

        return {
          isAuthenticated: false,
          authorizationUrl: `${
            this.APP_BASE_URL
          }/signup?mcp_token=${authToken}&redirect=${encodeURIComponent(
            this.MCP_CALLBACK_URL
          )}`,
          authToken: authToken,
          error:
            "User not found. Please sign up for SprintIQ to access MCP features.",
        };
      }

      // User exists, they are authenticated
      return {
        isAuthenticated: true,
      };
    } catch (error) {
      console.error("Error checking user authentication:", error);
      const authToken = this.generateAuthToken();
      await this.storePendingAuth(authToken, userEmail);

      return {
        isAuthenticated: false,
        authorizationUrl: `${
          this.APP_BASE_URL
        }/signin?mcp_token=${authToken}&redirect=${encodeURIComponent(
          this.MCP_CALLBACK_URL
        )}`,
        authToken: authToken,
        error: "Authentication check failed. Please sign in to SprintIQ.",
      };
    }
  }

  /**
   * Step 2: Establish connection and validate user
   * Now includes proper authorization flow
   */
  async establishConnection(userEmail: string): Promise<{
    success: boolean;
    connectionId?: string;
    user?: MCPValidatedUser;
    error?: string;
    requiresAuthorization?: boolean;
    authorizationUrl?: string;
  }> {
    try {
      // First check authentication
      const authStatus = await this.checkUserAuthentication(userEmail);

      if (!authStatus.isAuthenticated) {
        return {
          success: false,
          requiresAuthorization: true,
          authorizationUrl: authStatus.authorizationUrl,
          error: authStatus.error || "Authentication required",
        };
      }

      // Validate user and get full context
      const validation = await mcpUserValidationService.validateUserByEmail(
        userEmail
      );

      if (!validation.isValid || !validation.user) {
        return {
          success: false,
          requiresAuthorization: true,
          authorizationUrl: `${
            this.APP_BASE_URL
          }/signin?redirect=${encodeURIComponent(this.MCP_CALLBACK_URL)}`,
          error: validation.error || "User validation failed",
        };
      }

      // Create connection
      const connectionId = `conn_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const connectionStatus: MCPConnectionStatus = {
        isConnected: true,
        hasActiveConnection: true,
        connectionId,
        establishedAt: new Date(),
        lastActivity: new Date(),
      };

      this.activeConnections.set(userEmail, connectionStatus);

      // Store user session
      await this.storeUserSession(userEmail, {
        user: validation.user,
        connectionId,
      });

      return {
        success: true,
        connectionId,
        user: validation.user,
      };
    } catch (error) {
      console.error("Error establishing connection:", error);
      return {
        success: false,
        requiresAuthorization: true,
        authorizationUrl: `${
          this.APP_BASE_URL
        }/signin?redirect=${encodeURIComponent(this.MCP_CALLBACK_URL)}`,
        error: "Failed to establish connection. Please try signing in again.",
      };
    }
  }

  /**
   * Step 3: Handle workspace selection
   */
  async handleWorkspaceSelection(
    userEmail: string,
    workspaceId?: string
  ): Promise<MCPWorkspaceSelection> {
    try {
      const userSession = await this.getUserSession(userEmail);

      if (!userSession) {
        throw new Error(
          "No active session found. Please establish connection first."
        );
      }

      const { user } = userSession;
      const availableWorkspaces = user.workspaces;

      // If user has no workspaces, return error
      if (!availableWorkspaces || availableWorkspaces.length === 0) {
        throw new Error(
          "No workspaces found for user. Please create a workspace first or contact your administrator."
        );
      }

      // Check if user already has a workspace selected
      if (userSession.workspace) {
        return {
          workspaces: availableWorkspaces,
          selectedWorkspace: userSession.workspace,
          requiresSelection: false,
        };
      }

      // If workspace ID is provided, validate and select it
      if (workspaceId) {
        const selectedWorkspace = availableWorkspaces.find(
          (w) => w.workspace_id === workspaceId || w.id === workspaceId
        );

        if (!selectedWorkspace) {
          throw new Error(
            `Workspace ${workspaceId} not found or not accessible`
          );
        }

        // Update user session with selected workspace
        await this.updateUserSession(userEmail, {
          workspace: selectedWorkspace,
        });

        return {
          workspaces: availableWorkspaces,
          selectedWorkspace,
          requiresSelection: false,
        };
      }

      // If only one workspace, auto-select it
      if (availableWorkspaces.length === 1) {
        const selectedWorkspace = availableWorkspaces[0];
        await this.updateUserSession(userEmail, {
          workspace: selectedWorkspace,
        });

        return {
          workspaces: availableWorkspaces,
          selectedWorkspace,
          requiresSelection: false,
        };
      }

      // Multiple workspaces, user needs to select
      return {
        workspaces: availableWorkspaces,
        requiresSelection: true,
      };
    } catch (error) {
      console.error("Error handling workspace selection:", error);
      throw error;
    }
  }

  /**
   * Select workspace by name or ID
   */
  async selectWorkspaceByName(
    userEmail: string,
    workspaceNameOrId: string
  ): Promise<MCPWorkspaceSelection> {
    try {
      const userSession = await this.getUserSession(userEmail);

      if (!userSession) {
        throw new Error(
          "No active session found. Please establish connection first."
        );
      }

      const { user } = userSession;
      const availableWorkspaces = user.workspaces;

      // Find workspace by name (case-insensitive) or ID
      const selectedWorkspace = availableWorkspaces.find(
        (w) =>
          w.name.toLowerCase() === workspaceNameOrId.toLowerCase() ||
          w.workspace_id === workspaceNameOrId ||
          w.id === workspaceNameOrId
      );

      if (!selectedWorkspace) {
        // Return available options if workspace not found
        const workspaceOptions = availableWorkspaces
          .map(
            (w, index) =>
              `${index + 1}. ${w.name} (ID: ${w.id}) - Role: ${w.role}`
          )
          .join("\n");

        throw new Error(
          `Workspace "${workspaceNameOrId}" not found. Available workspaces:\n${workspaceOptions}`
        );
      }

      // Update user session with selected workspace
      await this.updateUserSession(userEmail, {
        workspace: selectedWorkspace,
      });

      return {
        workspaces: availableWorkspaces,
        selectedWorkspace,
        requiresSelection: false,
      };
    } catch (error) {
      console.error("Error selecting workspace by name:", error);
      throw error;
    }
  }

  /**
   * Step 4: Handle team member selection
   */
  async handleTeamMemberSelection(
    userEmail: string,
    selectedTeamMemberIds?: string[]
  ): Promise<MCPTeamMemberSelection> {
    try {
      const userSession = await this.getUserSession(userEmail);

      if (!userSession || !userSession.workspace) {
        throw new Error("No active session or workspace selected");
      }

      const availableTeamMembers = userSession.workspace.teams;

      // If no team members in workspace, proceed without selection
      if (!availableTeamMembers || availableTeamMembers.length === 0) {
        return {
          teamMembers: [],
          requiresSelection: false,
        };
      }

      // If team member IDs are provided, validate and select them
      if (selectedTeamMemberIds && selectedTeamMemberIds.length > 0) {
        const selectedMembers = availableTeamMembers.filter((member) =>
          selectedTeamMemberIds.includes(member.id)
        );

        if (selectedMembers.length === 0) {
          throw new Error("No valid team members found for the provided IDs");
        }

        // Update user session with selected team members
        await this.updateUserSession(userEmail, {
          teamMembers: selectedMembers,
        });

        return {
          teamMembers: availableTeamMembers,
          selectedMembers,
          requiresSelection: false,
        };
      }

      // Team members available, user needs to select
      return {
        teamMembers: availableTeamMembers,
        requiresSelection: true,
      };
    } catch (error) {
      console.error("Error handling team member selection:", error);
      throw error;
    }
  }

  /**
   * Detect if user is trying to select a workspace through natural language
   */
  private detectWorkspaceSelection(params: any): string | null {
    // Check common patterns for workspace selection
    const patterns = [
      /use workspace\s+([^\s]+)/i,
      /select workspace\s+([^\s]+)/i,
      /workspace\s+([^\s]+)/i,
      /switch to\s+([^\s]+)/i,
      /go to\s+([^\s]+)/i,
      /work in\s+([^\s]+)/i,
      /choose\s+([^\s]+)/i,
    ];

    // Check if any parameter contains workspace selection text
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") {
        for (const pattern of patterns) {
          const match = value.match(pattern);
          if (match && match[1]) {
            return match[1];
          }
        }

        // Also check if the entire parameter value could be a workspace name
        // This handles cases where user just says "Dream1" or similar
        // Only do this for certain parameter names that are likely to contain workspace names
        if (
          key.toLowerCase().includes("workspace") ||
          key.toLowerCase().includes("name")
        ) {
          const trimmed = value.trim();
          if (
            trimmed.length > 0 &&
            trimmed.length < 50 &&
            !trimmed.includes(" ")
          ) {
            // Could be a workspace name, but we need to validate it
            return trimmed;
          }
        }
      }
    }

    return null;
  }

  /**
   * Step 5: Execute tool with proper context
   */
  async executeToolWithWorkflow(
    userEmail: string,
    toolName: string,
    params: any,
    workspaceId?: string,
    selectedTeamMemberIds?: string[]
  ): Promise<MCPToolResult> {
    try {
      // Input validation
      if (!userEmail || typeof userEmail !== "string") {
        return {
          success: false,
          error: "Invalid userEmail parameter",
          metadata: {
            step: "input_validation",
            details: "userEmail must be a non-empty string",
          },
        };
      }

      if (!toolName || typeof toolName !== "string") {
        return {
          success: false,
          error: "Invalid toolName parameter",
          metadata: {
            step: "input_validation",
            details: "toolName must be a non-empty string",
          },
        };
      }

      if (!params || typeof params !== "object") {
        return {
          success: false,
          error: "Invalid params parameter",
          metadata: {
            step: "input_validation",
            details: "params must be an object",
          },
        };
      }

      // Check if user is trying to select a workspace through natural language
      // Only do this if they don't already have a workspace selected
      const currentSession = await this.getUserSession(userEmail);

      if (!currentSession?.workspace) {
        const workspaceSelection = this.detectWorkspaceSelection(params);
        if (workspaceSelection) {
          try {
            const result = await this.selectWorkspaceByName(
              userEmail,
              workspaceSelection
            );

            if (result.selectedWorkspace) {
              return {
                success: true,
                data: [
                  {
                    type: "text",
                    text: `✅ Workspace "${result.selectedWorkspace.name}" selected successfully!\n\nYou are now working in workspace: ${result.selectedWorkspace.name}\nYou can now use other SprintIQ tools to create tasks, projects, etc.\nFor example: 'List my projects' or 'Create a task called "Fix login bug"'`,
                  },
                ],
                metadata: {
                  step: "workspace_selected",
                  workspaceId: result.selectedWorkspace.id,
                  workspaceName: result.selectedWorkspace.name,
                  timestamp: new Date().toISOString(),
                },
              };
            }
          } catch (error) {
            // If workspace selection fails, continue with normal flow
            // This allows the system to show the workspace selection prompt
          }
        }
      }

      // Special handling for SPRINTIQ_CHECK_ACTIVE_CONNECTION - it handles its own workflow
      if (toolName === "SPRINTIQ_CHECK_ACTIVE_CONNECTION") {
        try {
          // For connection check, we pass userEmail as a parameter and let it handle the flow
          const connectionCheckParams = {
            ...params,
            userEmail: userEmail,
          };

          const { SprintiQMCPServer } = await import("./server");
          const server = new SprintiQMCPServer();

          // Build a minimal context for the connection check
          const connectionContext: SprintiQContext = {
            workspaceId: "",
            userId: "",
            email: userEmail,
            permissions: [],
          };

          return await server.callTool(toolName, connectionCheckParams, connectionContext);
        } catch (error) {
          console.error("Connection check error:", error);
          return {
            success: false,
            error: "Failed to check connection status",
            metadata: {
              step: "connection_check",
              details: error instanceof Error ? error.message : "Unknown error",
            },
          };
        }
      }

      // Step 1: Check if user has an active session (skip connection check)
      try {
        const userSession = await this.getUserSession(userEmail);

        if (!userSession) {
          // No session found, try to establish connection
          const connectionResult = await this.establishConnection(userEmail);

          if (!connectionResult.success) {
            return {
              success: false,
              error: connectionResult.error || "Failed to establish connection",
              metadata: {
                step: "connection_establishment",
                requiresAuthorization: connectionResult.requiresAuthorization,
                authorizationUrl: connectionResult.authorizationUrl,
                details: "Could not establish a connection for the user",
              },
            };
          }
        }
      } catch (error) {
        console.error("Connection handling error:", error);
        return {
          success: false,
          error: "Connection error",
          metadata: {
            step: "connection_handling",
            details: error instanceof Error ? error.message : "Unknown error",
          },
        };
      }

      // Step 2: Handle workspace selection
      let finalUserSession: {
        user: MCPValidatedUser;
        workspace?: MCPWorkspaceInfo;
        teamMembers?: MCPTeamInfo[];
        connectionId: string;
      } | null = null;

      try {
        const workspaceSelection = await this.handleWorkspaceSelection(
          userEmail,
          workspaceId
        );

        if (workspaceSelection.requiresSelection) {
          // Format workspace options for clear presentation
          const workspaceOptions = workspaceSelection.workspaces
            .map(
              (w, index) =>
                `${index + 1}. ${w.name} (ID: ${w.id}) - Role: ${w.role}`
            )
            .join("\n");

          return {
            success: false,
            error: "Workspace selection required",
            data: {
              message: "Please select a workspace to continue:",
              workspaces: workspaceOptions,
              availableWorkspaces: workspaceSelection.workspaces.map((w) => ({
                id: w.id,
                name: w.name,
                role: w.role,
              })),
              instructions: [
                "You have access to multiple workspaces.",
                "Please specify which workspace you'd like to use by providing the workspace name or ID.",
                "You can respond with any of these formats:",
                "- 'Use workspace Dream1'",
                "- 'Select workspace Dream1'",
                "- 'Switch to Dream1'",
                "- Just 'Dream1'",
                `Available workspaces:\n${workspaceOptions}`,
              ],
            },
            metadata: {
              step: "workspace_selection",
              requiresWorkspaceSelection: true,
              details: "User needs to select a workspace before proceeding",
            },
          };
        }

        // Workspace was selected, get the updated session
        finalUserSession = await this.getUserSession(userEmail);
        if (!finalUserSession || !finalUserSession.workspace) {
          console.error(
            `[MCP] Workspace selection completed but session not updated properly for ${userEmail}`
          );
          return {
            success: false,
            error: "Workspace selection failed to persist",
            metadata: {
              step: "workspace_selection",
              details:
                "Workspace was selected but session was not updated properly",
            },
          };
        }
      } catch (error) {
        console.error("Workspace selection error:", error);
        return {
          success: false,
          error: "Workspace selection failed",
          metadata: {
            step: "workspace_selection",
            details: error instanceof Error ? error.message : "Unknown error",
          },
        };
      }

      // Step 3: Handle team member selection (if needed for the tool)
      if (this.toolRequiresTeamMembers(toolName)) {
        try {
          const teamMemberSelection = await this.handleTeamMemberSelection(
            userEmail,
            selectedTeamMemberIds
          );

          if (teamMemberSelection.requiresSelection) {
            return {
              success: false,
              error: "Team member selection required",
              data: {
                availableTeamMembers: teamMemberSelection.teamMembers.map(
                  (m) => ({
                    id: m.id,
                    name: m.name,
                    role: m.role,
                    level: m.level,
                  })
                ),
              },
              metadata: {
                step: "team_member_selection",
                requiresTeamMemberSelection: true,
                details: "User needs to select team members",
              },
            };
          }

          // Team members were selected, get the updated session
          finalUserSession = await this.getUserSession(userEmail);
        } catch (error) {
          console.error("Team member selection error:", error);
          return {
            success: false,
            error: "Team member selection failed",
            metadata: {
              step: "team_member_selection",
              details: error instanceof Error ? error.message : "Unknown error",
            },
          };
        }
      }

      // Step 4: Execute the tool
      try {
        // Use the session we already have from the workflow steps
        const userSession =
          finalUserSession || (await this.getUserSession(userEmail));
        if (!userSession) {
          return {
            success: false,
            error: "Invalid session",
            metadata: {
              step: "execution",
              details: "User session not found. Please try reconnecting.",
            },
          };
        }

        const context = this.createExecutionContext(userSession);
        const result = await this.executeTool(toolName, params, context);

        // Step 5: Handle post-execution based on tool type
        if (toolName === "SPRINTIQ_GENERATE_USER_STORIES") {
          try {
            return await this.handleStoryGenerationResult(result, userSession);
          } catch (error) {
            console.error("Story generation post-processing error:", error);
            return {
              success: false,
              error: "Story generation post-processing failed",
              metadata: {
                step: "post_execution",
                details:
                  error instanceof Error ? error.message : "Unknown error",
              },
            };
          }
        }

        return result;
      } catch (error) {
        console.error("Tool execution error:", error);
        return {
          success: false,
          error: "Tool execution failed",
          metadata: {
            step: "execution",
            details: error instanceof Error ? error.message : "Unknown error",
          },
        };
      }
    } catch (error) {
      console.error("Unexpected error in executeToolWithWorkflow:", error);
      return {
        success: false,
        error: "Internal workflow error",
        metadata: {
          step: "workflow",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Step 6: Handle story generation result with post-execution options
   */
  private async handleStoryGenerationResult(
    result: MCPToolResult,
    userSession: {
      user: MCPValidatedUser;
      workspace?: MCPWorkspaceInfo;
      teamMembers?: MCPTeamInfo[];
    }
  ): Promise<MCPToolResult> {
    if (!result.success) {
      return result;
    }

    const storyResult: MCPStoryGenerationResult = {
      stories: result.data.stories || result.data,
      metadata: {
        workspaceId: userSession.workspace!.workspace_id,
        teamMembers: userSession.teamMembers,
        generatedAt: new Date(),
      },
    };

    return {
      success: true,
      data: storyResult,
      metadata: {
        ...result.metadata,
        step: "story_generation_complete",
        requiresPostExecutionChoice: true,
        postExecutionOptions: {
          saveAsStoriesOnly: "Save generated stories as individual tasks",
          saveWithSprints: "Create sprints and organize stories within them",
        },
      },
    };
  }

  /**
   * Handle post-execution choice for story generation
   */
  async handlePostExecutionChoice(
    userEmail: string,
    choice: "saveAsStoriesOnly" | "saveWithSprints",
    storyData: MCPStoryGenerationResult,
    options?: {
      sprintDuration?: number;
      createSprintFolder?: boolean;
    }
  ): Promise<MCPToolResult> {
    try {
      const userSession = await this.getUserSession(userEmail);

      if (!userSession || !userSession.workspace) {
        throw new Error("No active session or workspace");
      }

      const context = this.createExecutionContext(userSession);

      if (choice === "saveAsStoriesOnly") {
        return await this.saveStoriesOnly(storyData, context);
      } else if (choice === "saveWithSprints") {
        return await this.saveStoriesWithSprints(storyData, context, options);
      }

      throw new Error("Invalid post-execution choice");
    } catch (error) {
      console.error("Error handling post-execution choice:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Save stories as individual tasks only
   */
  private async saveStoriesOnly(
    storyData: MCPStoryGenerationResult,
    context: SprintiQContext
  ): Promise<MCPToolResult> {
    try {
      const supabase = await createServerSupabaseClient();
      const savedStories: TaskRow[] = [];

      // Get the workspace UUID from workspace_id
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id")
        .eq("workspace_id", context.workspaceId)
        .single();

      if (workspaceError || !workspace) {
        console.error("Error finding workspace:", workspaceError);
        return {
          success: false,
          error: "Workspace not found",
        };
      }

      // Get the first space for this workspace to use as default
      const { data: spaces, error: spaceError } = await supabase
        .from("spaces")
        .select("id")
        .eq("workspace_id", workspace.id)
        .limit(1);

      if (spaceError || !spaces || spaces.length === 0) {
        console.error("Error finding spaces:", spaceError);
        return {
          success: false,
          error: "No spaces found in workspace",
        };
      }

      const spaceId = spaces[0].id;

      // Get the first available status for this workspace
      const { data: statuses, error: statusError } = await supabase
        .from("statuses")
        .select("id")
        .eq("workspace_id", workspace.id)
        .order("position", { ascending: true })
        .limit(1);

      if (statusError || !statuses || statuses.length === 0) {
        console.error("Error finding statuses:", statusError);
        return {
          success: false,
          error: "No statuses found in workspace",
        };
      }

      const statusId = statuses[0].id;

      for (const story of storyData.stories) {
        const { data: task, error } = await supabase
          .from("tasks")
          .insert({
            name: story.title,
            description: story.description,
            status_id: statusId,
            priority: story.priority?.toLowerCase() || "medium",
            project_id: context.projectId || null,
            space_id: spaceId,
            workspace_id: workspace.id,
            created_by: context.userId,
            story_points: story.storyPoints,
            type: "ai-generated",
          })
          .select()
          .single();

        if (error) {
          console.error("Error saving story:", error);
          continue;
        }

        savedStories.push(task);
      }

      return {
        success: true,
        data: {
          savedStories,
          count: savedStories.length,
        },
        metadata: {
          action: "stories_saved",
          workspaceId: context.workspaceId,
        },
      };
    } catch (error) {
      console.error("Error saving stories:", error);
      return {
        success: false,
        error: "Failed to save stories",
      };
    }
  }

  /**
   * Save stories with sprints
   */
  private async saveStoriesWithSprints(
    storyData: MCPStoryGenerationResult,
    context: SprintiQContext,
    options?: {
      sprintDuration?: number;
      createSprintFolder?: boolean;
    }
  ): Promise<MCPToolResult> {
    try {
      // First save stories as individual tasks
      const storiesResult = await this.saveStoriesOnly(storyData, context);

      if (!storiesResult.success) {
        return storiesResult;
      }

      // Then create a sprint and assign the stories to it
      const sprintName = `Sprint ${new Date().toISOString().split("T")[0]}`;
      const sprintParams = {
        sprints: [
          {
            name: sprintName,
            goal: `Complete ${storyData.stories.length} user stories`,
            duration: options?.sprintDuration || 14,
          },
        ],
        sprintFolderId:
          context.workspaceData?.spaces?.[0]?.sprint_folders?.[0]?.id ||
          "default",
        spaceId: context.workspaceData?.spaces?.[0]?.id || "default",
        workspaceId: context.workspaceId,
      };

      const { createSprints } = await getAiActions();
      const result = await createSprints(sprintParams);

      return {
        success: true,
        data: {
          stories: storiesResult.data.savedStories,
          sprints: result,
        },
        metadata: {
          action: "stories_saved_with_sprints",
          workspaceId: context.workspaceId,
        },
      };
    } catch (error) {
      console.error("Error saving stories with sprints:", error);
      return {
        success: false,
        error: "Failed to save stories with sprints",
      };
    }
  }

  /**
   * Helper methods
   */
  private toolRequiresTeamMembers(toolName: string): boolean {
    const teamRequiredTools = [
      "SPRINTIQ_GENERATE_USER_STORIES",
      "SPRINTIQ_ANALYZE_TASK_PRIORITY",
      "SPRINTIQ_ASSIGN_TASK",
      "SPRINTIQ_GET_TEAM_CAPACITY",
    ];
    return teamRequiredTools.includes(toolName);
  }

  private createExecutionContext(userSession: {
    user: MCPValidatedUser;
    workspace?: MCPWorkspaceInfo;
    teamMembers?: MCPTeamInfo[];
  }): SprintiQContext {
    if (!userSession.workspace) {
      throw new Error("No workspace selected");
    }

    return mcpUserValidationService.createSprintiQContext(
      userSession.user,
      userSession.workspace.workspace_id,
      undefined, // projectId
      undefined, // sprintId
      userSession.teamMembers?.[0]?.id // teamId
    );
  }

  private async executeTool(
    toolName: string,
    params: any,
    context: SprintiQContext
  ): Promise<MCPToolResult> {
    try {
      // For now, we'll use the internal server implementation
      // This can be extended to use external MCP servers
      const { SprintiQMCPServer } = await import("./server");
      const server = new SprintiQMCPServer();

      const result = await server.callTool(toolName, params, context);

      // The server already returns an MCPToolResult, so we can return it directly
      if (result && typeof result === "object" && "success" in result) {
        return result;
      }

      // If the result is not in the expected format, wrap it
      return {
        success: true,
        data: result,
        metadata: {
          tool: toolName,
          executedAt: new Date().toISOString(),
          context: {
            workspaceId: context.workspaceId,
            userId: context.userId,
            email: context.email,
          },
        },
      };
    } catch (error) {
      console.error("Error executing tool:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Tool execution failed",
        metadata: {
          tool: toolName,
          executedAt: new Date().toISOString(),
          errorType:
            error instanceof Error ? error.constructor.name : "UnknownError",
          context: {
            workspaceId: context.workspaceId,
            userId: context.userId,
            email: context.email,
          },
        },
      };
    }
  }

  /**
   * Cleanup inactive connections
   */
  async cleanupInactiveConnections(
    maxIdleTime: number = 30 * 60 * 1000
  ): Promise<void> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - maxIdleTime);

    for (const [email, connection] of this.activeConnections.entries()) {
      if (connection.lastActivity && connection.lastActivity < cutoff) {
        this.activeConnections.delete(email);
        // No need to delete from userSessions here, as it's now database-backed
      }
    }
  }

  /**
   * Disconnect user session
   */
  async disconnectUser(userEmail: string): Promise<void> {
    this.activeConnections.delete(userEmail);
    // No need to delete from userSessions here, as it's now database-backed
  }

  /**
   * Get authorization info for a user
   */
  async getAuthorizationInfo(userEmail: string): Promise<MCPAuthorizationInfo> {
    const authStatus = await this.checkUserAuthentication(userEmail);

    if (!authStatus.isAuthenticated) {
      return {
        isRequired: true,
        authorizationUrl: authStatus.authorizationUrl,
        message:
          authStatus.error ||
          "Please sign in to SprintIQ to access MCP features.",
        redirectUrl: this.MCP_CALLBACK_URL,
      };
    }

    return {
      isRequired: false,
      message: "User is authenticated and ready to use MCP features.",
    };
  }
}

// Export singleton instance
export const enhancedMCPService = EnhancedMCPService.getInstance();
