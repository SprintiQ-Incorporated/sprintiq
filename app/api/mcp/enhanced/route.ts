import { NextRequest, NextResponse } from "next/server";
import { mcpService } from "@/lib/mcp/service";
import { enhancedMCPService } from "@/lib/mcp/enhanced-service";

/**
 * Enhanced MCP API endpoint with proper workflow implementation
 *
 * Implements the workflow:
 * 1. Check active connection (SPRINTIQ_CHECK_ACTIVE_CONNECTION)
 * 2. User validation and authorization
 * 3. Workspace selection (if needed)
 * 4. Team member selection (if needed)
 * 5. Tool execution
 * 6. Post-execution options (for story generation)
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      userEmail,
      toolName,
      params,
      workspaceId,
      selectedTeamMemberIds,
      postExecutionChoice,
      storyData,
      options,
    } = body;

    if (!userEmail) {
      return NextResponse.json(
        {
          error: "Email is required",
        },
        { status: 400 }
      );
    }

    // Handle different workflow actions
    switch (action) {
      case "checkConnection":
        return await handleCheckConnection(userEmail);

      case "establishConnection":
        return await handleEstablishConnection(userEmail);

      case "selectWorkspace":
        return await handleWorkspaceSelection(userEmail, workspaceId);

      case "selectTeamMembers":
        return await handleTeamMemberSelection(
          userEmail,
          selectedTeamMemberIds
        );

      case "executeTool":
        return await handleToolExecution(
          userEmail,
          toolName,
          params,
          workspaceId,
          selectedTeamMemberIds
        );

      case "postExecutionChoice":
        return await handlePostExecution(
          userEmail,
          postExecutionChoice,
          storyData,
          options
        );

      default:
        return NextResponse.json(
          {
            error:
              "Invalid action. Supported actions: checkConnection, establishConnection, selectWorkspace, selectTeamMembers, executeTool, postExecutionChoice",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Enhanced MCP API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Step 1: Check active connection
 */
async function handleCheckConnection(userEmail: string) {
  try {
    const connectionStatus = await mcpService.checkActiveConnection(userEmail);

    return NextResponse.json({
      success: true,
      connectionStatus,
      nextStep: connectionStatus.isConnected
        ? "selectWorkspace"
        : "establishConnection",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Connection check failed",
      },
      { status: 500 }
    );
  }
}

/**
 * Step 2: Establish connection and validate user
 */
async function handleEstablishConnection(userEmail: string) {
  try {
    const result = await mcpService.establishConnection(userEmail);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          requiresAuthorization: result.requiresAuthorization || true,
          authorizationUrl: result.authorizationUrl,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      connectionId: result.connectionId,
      user: {
        id: result.user?.id,
        email: result.user?.email,
        name: result.user?.name,
        company: result.user?.company,
        workspaces: result.user?.workspaces.map((w) => ({
          id: w.workspace_id,
          name: w.name,
          role: w.role,
          spacesCount: w.spaces.length,
          teamsCount: w.teams.length,
        })),
      },
      nextStep: "selectWorkspace",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Connection establishment failed",
      },
      { status: 500 }
    );
  }
}

/**
 * Step 3: Handle workspace selection
 */
async function handleWorkspaceSelection(
  userEmail: string,
  workspaceId?: string
) {
  try {
    const result = await mcpService.handleWorkspaceSelection(
      userEmail,
      workspaceId
    );

    if (result.requiresSelection) {
      return NextResponse.json({
        success: false,
        requiresWorkspaceSelection: true,
        availableWorkspaces: result.workspaces.map((w) => ({
          id: w.workspace_id,
          name: w.name,
          role: w.role,
          spacesCount: w.spaces.length,
          teamsCount: w.teams.length,
        })),
        message: "Please select a workspace to continue",
      });
    }

    return NextResponse.json({
      success: true,
      selectedWorkspace: {
        id: result.selectedWorkspace?.workspace_id,
        name: result.selectedWorkspace?.name,
        role: result.selectedWorkspace?.role,
        teamsCount: result.selectedWorkspace?.teams?.length || 0,
      },
      nextStep:
        (result.selectedWorkspace?.teams?.length || 0) > 0
          ? "selectTeamMembers"
          : "executeTool",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Workspace selection failed",
      },
      { status: 500 }
    );
  }
}

/**
 * Step 4: Handle team member selection
 */
async function handleTeamMemberSelection(
  userEmail: string,
  selectedTeamMemberIds?: string[]
) {
  try {
    const result = await mcpService.handleTeamMemberSelection(
      userEmail,
      selectedTeamMemberIds
    );

    if (result.requiresSelection) {
      return NextResponse.json({
        success: false,
        requiresTeamMemberSelection: true,
        availableTeamMembers: result.teamMembers.map((tm) => ({
          id: tm.id,
          name: tm.name,
          role: tm.role,
          level: tm.level,
        })),
        message: "Please select team members to continue",
      });
    }

    return NextResponse.json({
      success: true,
      selectedTeamMembers:
        result.selectedMembers?.map((tm) => ({
          id: tm.id,
          name: tm.name,
          role: tm.role,
          level: tm.level,
        })) || [],
      nextStep: "executeTool",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Team member selection failed",
      },
      { status: 500 }
    );
  }
}

/**
 * Step 5: Execute tool with proper workflow
 */
async function handleToolExecution(
  userEmail: string,
  toolName: string,
  params: any,
  workspaceId?: string,
  selectedTeamMemberIds?: string[]
) {
  try {
    if (!toolName) {
      return NextResponse.json(
        {
          error: "Tool name is required",
        },
        { status: 400 }
      );
    }

    const result = await mcpService.executeToolWithWorkflow(
      userEmail,
      toolName,
      params,
      workspaceId,
      selectedTeamMemberIds
    );

    // Handle different types of results
    if (!result.success) {
      // Check if it's an authorization requirement
      if (result.metadata?.requiresAuthorization) {
        // Include authorization URL if not already present
        if (!result.metadata.authorizationUrl) {
          const authInfo = await enhancedMCPService.getAuthorizationInfo(
            userEmail
          );
          result.metadata.authorizationUrl = authInfo.authorizationUrl;
        }

        return NextResponse.json(
          {
            step: "authorization_required",
            ...result,
          },
          { status: 403 }
        );
      }

      // Check if it's a workflow step that needs user input
      if (result.metadata?.requiresWorkspaceSelection) {
        return NextResponse.json({
          step: "workspace_selection",
          ...result,
        });
      }

      if (result.metadata?.requiresTeamMemberSelection) {
        return NextResponse.json({
          step: "team_member_selection",
          ...result,
        });
      }

      // Regular error
      return NextResponse.json(result, { status: 400 });
    }

    // Check if tool requires post-execution choice
    if (result.metadata?.requiresPostExecutionChoice) {
      return NextResponse.json({
        success: true,
        toolResult: result.data,
        requiresPostExecutionChoice: true,
        postExecutionOptions: result.metadata.postExecutionOptions,
        message:
          "Stories generated successfully. How would you like to save them?",
      });
    }

    // Regular successful result
    return NextResponse.json({
      success: true,
      result: result.data,
      metadata: result.metadata,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Tool execution failed",
      },
      { status: 500 }
    );
  }
}

/**
 * Step 6: Handle post-execution choice
 */
async function handlePostExecution(
  userEmail: string,
  choice: "saveAsStoriesOnly" | "saveWithSprints",
  storyData: any,
  options?: any
) {
  try {
    if (!choice || !storyData) {
      return NextResponse.json(
        {
          error: "Choice and story data are required",
        },
        { status: 400 }
      );
    }

    const result = await enhancedMCPService.handlePostExecutionChoice(
      userEmail,
      choice,
      storyData,
      options
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      result: result.data,
      message:
        choice === "saveAsStoriesOnly"
          ? "Stories saved successfully as individual tasks"
          : "Stories saved successfully with sprints",
      metadata: result.metadata,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Post-execution handling failed",
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for API documentation
 */
export async function GET() {
  return NextResponse.json({
    name: "Enhanced SprintiQ MCP API",
    version: "1.0.0",
    description: "Enhanced MCP API with proper workflow implementation",
    workflow: {
      "1": "checkConnection - Check if user has active connection",
      "2": "establishConnection - Validate user and establish connection",
      "3": "selectWorkspace - Handle workspace selection",
      "4": "selectTeamMembers - Handle team member selection (if needed)",
      "5": "executeTool - Execute the requested tool",
      "6": "postExecutionChoice - Handle post-execution options (for story generation)",
    },
    example: {
      "Step 1": {
        action: "checkConnection",
        userEmail: "user@example.com",
      },
      "Step 2": {
        action: "establishConnection",
        userEmail: "user@example.com",
      },
      "Step 3": {
        action: "selectWorkspace",
        userEmail: "user@example.com",
        workspaceId: "workspace-id",
      },
      "Step 4": {
        action: "selectTeamMembers",
        userEmail: "user@example.com",
        selectedTeamMemberIds: ["member1", "member2"],
      },
      "Step 5": {
        action: "executeTool",
        userEmail: "user@example.com",
        toolName: "generateUserStories",
        params: {
          featureDescription: "Shopping system management",
          numberOfStories: 3,
          complexity: "moderate",
        },
      },
      "Step 6": {
        action: "postExecutionChoice",
        userEmail: "user@example.com",
        postExecutionChoice: "saveWithSprints",
        storyData: "generated_story_data",
        options: { sprintDuration: 14 },
      },
    },
  });
}
