import { NextRequest, NextResponse } from "next/server";
import { mcpService } from "@/lib/mcp/service";

/**
 * Example API endpoint demonstrating email-based MCP user validation
 *
 * This endpoint shows how to:
 * 1. Validate a user by email
 * 2. Create SprintiQ context
 * 3. Execute MCP tools with proper authentication
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, workspaceId, projectId, sprintId, teamId } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate user by email
    const validation = await mcpService.validateUserByEmail(email);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: validation.error || "User validation failed",
          isValid: false,
        },
        { status: 403 }
      );
    }

    if (!validation.user) {
      return NextResponse.json(
        { error: "User data not found" },
        { status: 404 }
      );
    }

    // Create SprintiQ context
    let context;
    try {
      context = mcpService.createSprintiQContext(
        validation.user,
        workspaceId,
        projectId,
        sprintId,
        teamId
      );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to create context",
          isValid: true,
          user: validation.user,
        },
        { status: 400 }
      );
    }

    // Return successful validation with user data and context
    return NextResponse.json({
      isValid: true,
      user: {
        id: validation.user.id,
        email: validation.user.email,
        name: validation.user.name,
        company: validation.user.company,
        workspaces: validation.user.workspaces.map((w) => ({
          id: w.id,
          workspace_id: w.workspace_id,
          name: w.name,
          role: w.role,
          spacesCount: w.spaces.length,
          teamsCount: w.teams.length,
          projectsCount: w.spaces.reduce(
            (total, space) => total + space.projects.length,
            0
          ),
          sprintsCount: w.spaces.reduce(
            (total, space) =>
              total +
              space.sprint_folders.reduce(
                (subTotal, folder) => subTotal + folder.sprints.length,
                0
              ),
            0
          ),
        })),
      },
      context: {
        workspaceId: context.workspaceId,
        userId: context.userId,
        email: context.email,
        permissions: context.permissions,
        teamId: context.teamId,
        projectId: context.projectId,
        sprintId: context.sprintId,
        workspaceData: context.workspaceData
          ? {
              id: context.workspaceData.id,
              workspace_id: context.workspaceData.workspace_id,
              name: context.workspaceData.name,
              role: context.workspaceData.role,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("MCP user validation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json(
      { error: "Email parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Quick validation check
    const validation = await mcpService.validateUserByEmail(email);

    return NextResponse.json({
      isValid: validation.isValid,
      error: validation.error,
      hasWorkspaces: validation.user?.workspaces.length || 0,
      userName: validation.user?.name,
    });
  } catch (error) {
    console.error("MCP user validation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
