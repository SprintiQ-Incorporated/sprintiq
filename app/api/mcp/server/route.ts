import { NextRequest, NextResponse } from "next/server";
import { SprintiQMCPServer } from "@/lib/mcp/server";
import { enhancedMCPService } from "@/lib/mcp/enhanced-service";
import { MCPMessage, SprintiQContext } from "@/lib/mcp/types";
import { mcpUserValidationService } from "@/lib/mcp/user-validation";

// Initialize the MCP server
const mcpServer = new SprintiQMCPServer();

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.MCP_RATE_LIMIT || "100");
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// CORS configuration. Defaults include localhost and the configured app URL
// (if any) so a self-hoster's deployment is allowed without source edits.
const CORS_ORIGINS = process.env.MCP_CORS_ORIGINS?.split(",") || [
  "https://claude.ai",
  "https://cursor.com",
  "https://openai.com",
  "http://localhost:3000",
  ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
];

// Create a default SprintiQContext for pre-authentication tools
// (e.g., SPRINTIQ_CHECK_ACTIVE_CONNECTION, SPRINTIQ_GET_AUTHENTICATED_USER)
// that do not require a workspace or user session.
function createDefaultContext(): SprintiQContext {
  return {
    workspaceId: "",
    userId: "",
    email: "",
    permissions: [],
  };
}

// Build a SprintiQContext from the completed authentication and selected workspace.
// Used by readResource and getPrompt handlers that require workspace context.
async function buildAuthenticatedContext(): Promise<SprintiQContext | null> {
  const completedAuth = await enhancedMCPService.getCompletedAuthentication();
  if (!completedAuth.success || !completedAuth.email) {
    return null;
  }

  // Validate the user and retrieve workspace information
  const validation = await mcpUserValidationService.validateUserByEmail(completedAuth.email);
  if (!validation.isValid || !validation.user) {
    return null;
  }

  // Use handleWorkspaceSelection to get the currently selected (or auto-selected) workspace
  try {
    const workspaceSelection = await enhancedMCPService.handleWorkspaceSelection(completedAuth.email);
    if (!workspaceSelection.selectedWorkspace) {
      return null;
    }

    return mcpUserValidationService.createSprintiQContext(
      validation.user,
      workspaceSelection.selectedWorkspace.workspace_id
    );
  } catch {
    return null;
  }
}

function handleCors(request: NextRequest) {
  const origin = request.headers.get("origin");
  const isAllowed =
    CORS_ORIGINS.includes("*") || (origin && CORS_ORIGINS.includes(origin));

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Max-Age": "86400",
  };

  if (isAllowed) {
    headers["Access-Control-Allow-Origin"] = origin || "";
  }

  return headers;
}

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const client = rateLimitStore.get(clientId);

  if (!client || now > client.resetTime) {
    rateLimitStore.set(clientId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (client.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  client.count++;
  return true;
}

export async function OPTIONS(request: NextRequest) {
  const corsHeaders = handleCors(request);
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const corsHeaders = handleCors(request);
  let messageId: string | number | null = null;

  try {
    // Validate content type
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Invalid content type. Expected application/json",
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get client identifier for rate limiting
    const clientId =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "anonymous";

    // Parse the message first to get the ID
    let message: MCPMessage;
    try {
      message = await request.json();
      messageId = message.id || null;
    } catch (error) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Parse error: Invalid JSON",
            data:
              error instanceof Error ? error.message : "Invalid JSON format",
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate JSON-RPC format
    if (!message.jsonrpc || message.jsonrpc !== "2.0" || !message.method) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: messageId,
          error: {
            code: -32600,
            message: "Invalid Request",
            data: "Request must include jsonrpc: '2.0' and method",
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check rate limit
    if (!checkRateLimit(clientId)) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: messageId,
          error: {
            code: -32000,
            message: "Rate limit exceeded. Please try again later.",
          },
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Retry-After": "60",
          },
        }
      );
    }

    // Handle different MCP methods
    switch (message.method) {
      case "initialize":
        return handleInitialize(message, corsHeaders);

      case "initialized":
        return handleInitialized(message, corsHeaders);

      case "server/info":
        return handleServerInfo(message, corsHeaders);

      case "tools/list":
        return handleListTools(message, corsHeaders);

      case "tools/call":
        if (!message.params || !message.params.name) {
          return NextResponse.json(
            {
              jsonrpc: "2.0",
              id: messageId,
              error: {
                code: -32602,
                message: "Invalid params",
                data: "tools/call requires params.name",
              },
            },
            { status: 400, headers: corsHeaders }
          );
        }
        return handleCallTool(message, corsHeaders);

      case "resources/list":
        return handleListResources(message, corsHeaders);

      case "resources/read":
        if (!message.params || !message.params.uri) {
          return NextResponse.json(
            {
              jsonrpc: "2.0",
              id: messageId,
              error: {
                code: -32602,
                message: "Invalid params",
                data: "resources/read requires params.uri",
              },
            },
            { status: 400, headers: corsHeaders }
          );
        }
        return handleReadResource(message, corsHeaders);

      case "prompts/list":
        return handleListPrompts(message, corsHeaders);

      case "prompts/get":
        if (!message.params || !message.params.name) {
          return NextResponse.json(
            {
              jsonrpc: "2.0",
              id: messageId,
              error: {
                code: -32602,
                message: "Invalid params",
                data: "prompts/get requires params.name",
              },
            },
            { status: 400, headers: corsHeaders }
          );
        }
        return handleGetPrompt(message, corsHeaders);

      default:
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: messageId,
            error: {
              code: -32601,
              message: `Method not found: ${message.method}`,
              data: "Supported methods: initialize, initialized, server/info, tools/list, tools/call, resources/list, resources/read, prompts/list, prompts/get",
            },
          },
          { status: 400, headers: corsHeaders }
        );
    }
  } catch (error) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: messageId,
        error: {
          code: -32603,
          message: "Internal error",
          data: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

async function handleInitialize(
  message: MCPMessage,
  corsHeaders: Record<string, string>
): Promise<NextResponse> {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        serverInfo: {
          name: "SprintiQ MCP Server",
          version: "1.0.0",
        },
      },
    },
    { headers: corsHeaders }
  );
}

async function handleInitialized(
  message: MCPMessage,
  corsHeaders: Record<string, string>
): Promise<NextResponse> {
  // The initialized notification doesn't require a response
  return NextResponse.json({}, { status: 200, headers: corsHeaders });
}

async function handleServerInfo(
  message: MCPMessage,
  corsHeaders: Record<string, string>
): Promise<NextResponse> {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: message.id,
      result: mcpServer.info(),
    },
    { headers: corsHeaders }
  );
}

async function handleListTools(
  message: MCPMessage,
  corsHeaders: Record<string, string>
): Promise<NextResponse> {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        tools: mcpServer.listTools(),
      },
    },
    { headers: corsHeaders }
  );
}

async function handleCallTool(
  message: MCPMessage,
  corsHeaders: Record<string, string>
): Promise<NextResponse> {
  try {
    const { name, arguments: args } = message.params;

    // Validate required parameters
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32602,
            message: "Invalid params",
            data: "Tool name must be a non-empty string",
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!args || typeof args !== "object") {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32602,
            message: "Invalid params",
            data: "Tool arguments must be an object",
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Special handling for SPRINTIQ_CHECK_ACTIVE_CONNECTION
    if (name === "SPRINTIQ_CHECK_ACTIVE_CONNECTION") {
      try {
        const result = await mcpServer.callTool(name, args, createDefaultContext());

        // Always return the result as-is for this tool
        if (result.success) {
          return NextResponse.json(
            {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                content: [
                  {
                    type: "text",
                    text:
                      result.data.message +
                      "\n\n" +
                      result.data.instructions.join("\n") +
                      "\n\n" +
                      result.data.nextSteps,
                  },
                ],
                metadata: result.metadata,
              },
            },
            { headers: corsHeaders }
          );
        } else {
          return NextResponse.json(
            {
              jsonrpc: "2.0",
              id: message.id,
              error: {
                code: -32603,
                message: result.error || "Failed to check connection status",
                data: result.metadata,
              },
            },
            { status: 500, headers: corsHeaders }
          );
        }
      } catch (error) {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: message.id,
            error: {
              code: -32603,
              message: "Failed to check connection status",
              data: error instanceof Error ? error.message : "Unknown error",
            },
          },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Special handling for SPRINTIQ_GET_AUTHENTICATED_USER
    if (name === "SPRINTIQ_GET_AUTHENTICATED_USER") {
      try {
        const result = await mcpServer.callTool(name, args, createDefaultContext());

        if (result.success) {
          return NextResponse.json(
            {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                content: [
                  {
                    type: "text",
                    text:
                      result.data.message +
                      "\n\n" +
                      result.data.instructions.join("\n") +
                      "\n\n" +
                      result.data.nextSteps,
                  },
                ],
                metadata: result.metadata,
              },
            },
            { headers: corsHeaders }
          );
        } else {
          return NextResponse.json(
            {
              jsonrpc: "2.0",
              id: message.id,
              error: {
                code: -32603,
                message: result.error || "Failed to get authenticated user",
                data: result.metadata,
              },
            },
            { status: 500, headers: corsHeaders }
          );
        }
      } catch (error) {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: message.id,
            error: {
              code: -32603,
              message: "Failed to get authenticated user",
              data: error instanceof Error ? error.message : "Unknown error",
            },
          },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Special handling for SPRINTIQ_SELECT_WORKSPACE - use enhanced workflow
    if (name === "SPRINTIQ_SELECT_WORKSPACE") {
      try {
        // Get the user email from the most recent completed authentication
        const completedAuth =
          await enhancedMCPService.getCompletedAuthentication();

        if (!completedAuth.success || !completedAuth.email) {
          return NextResponse.json(
            {
              jsonrpc: "2.0",
              id: message.id,
              error: {
                code: -32603,
                message: "No authenticated user found",
                data: {
                  message:
                    "Please authenticate first using SPRINTIQ_CHECK_ACTIVE_CONNECTION",
                  instructions: [
                    "1. Call SPRINTIQ_CHECK_ACTIVE_CONNECTION to check authentication status",
                    "2. If not authenticated, follow the authorization URL to sign in",
                    "3. After signing in, call SPRINTIQ_GET_AUTHENTICATED_USER",
                    "4. Then you can select a workspace using SPRINTIQ_SELECT_WORKSPACE",
                  ],
                },
              },
            },
            { status: 401, headers: corsHeaders }
          );
        }

        // Use enhanced service to select workspace
        const result = await enhancedMCPService.selectWorkspaceByName(
          completedAuth.email,
          args.workspaceNameOrId
        );

        if (result.selectedWorkspace) {
          return NextResponse.json(
            {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                content: [
                  {
                    type: "text",
                    text: `✅ Workspace "${result.selectedWorkspace.name}" selected successfully!\n\nYou are now working in workspace: ${result.selectedWorkspace.name}\nYou can now use other SprintIQ tools to create tasks, projects, etc.\nFor example: 'Create a task called "Fix login bug"'`,
                  },
                ],
                metadata: {
                  tool: "SPRINTIQ_SELECT_WORKSPACE",
                  step: "selected",
                  timestamp: new Date().toISOString(),
                  workspaceId: result.selectedWorkspace.id,
                },
              },
            },
            { headers: corsHeaders }
          );
        } else {
          return NextResponse.json(
            {
              jsonrpc: "2.0",
              id: message.id,
              error: {
                code: -32603,
                message: "Failed to select workspace",
                data: {
                  tool: "SPRINTIQ_SELECT_WORKSPACE",
                  step: "selection_failed",
                  timestamp: new Date().toISOString(),
                },
              },
            },
            { status: 500, headers: corsHeaders }
          );
        }
      } catch (error) {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: message.id,
            error: {
              code: -32603,
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to select workspace",
              data: {
                tool: "SPRINTIQ_SELECT_WORKSPACE",
                step: "error",
                timestamp: new Date().toISOString(),
                errorDetails:
                  error instanceof Error ? error.message : "Unknown error",
              },
            },
          },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // For all other tools, use the enhanced workflow
    // First, get the user email from the most recent completed authentication
    const completedAuth = await enhancedMCPService.getCompletedAuthentication();

    if (!completedAuth.success || !completedAuth.email) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32603,
            message: "No authenticated user found",
            data: {
              message:
                "Please authenticate first using SPRINTIQ_CHECK_ACTIVE_CONNECTION",
              instructions: [
                "1. Call SPRINTIQ_CHECK_ACTIVE_CONNECTION to check authentication status",
                "2. If not authenticated, follow the authorization URL to sign in",
                "3. After signing in, call SPRINTIQ_GET_AUTHENTICATED_USER",
                "4. Then you can use other SprintIQ tools",
              ],
            },
          },
        },
        { status: 401, headers: corsHeaders }
      );
    }

    try {
      // Use the enhanced workflow which handles workspace selection automatically
      const result = await enhancedMCPService.executeToolWithWorkflow(
        completedAuth.email,
        name,
        args
      );

      // Handle workspace selection required case first (regardless of success status)
      if (result.metadata?.requiresWorkspaceSelection) {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: message.id,
            result: {
              content: [
                {
                  type: "text",
                  text:
                    result.data.message +
                    "\n\n" +
                    result.data.instructions.join("\n"),
                },
              ],
              metadata: result.metadata,
            },
          },
          { headers: corsHeaders }
        );
      }

      if (result.success) {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: message.id,
            result: {
              content: result.data,
              metadata: result.metadata,
            },
          },
          { headers: corsHeaders }
        );
      } else {
        // Handle different types of errors
        let statusCode = 500;
        let errorCode = -32603;
        let errorMessage = result.error || "Tool execution failed";

        if (result.error?.toLowerCase().includes("not found")) {
          statusCode = 404;
          errorCode = -32004;
          errorMessage = result.error;
        } else if (result.error?.toLowerCase().includes("invalid")) {
          statusCode = 400;
          errorCode = -32602;
          errorMessage = result.error;
        }

        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: message.id,
            error: {
              code: errorCode,
              message: errorMessage,
              data: result.metadata,
            },
          },
          { status: statusCode, headers: corsHeaders }
        );
      }
    } catch (error) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32603,
            message: "Tool execution failed",
            data: error instanceof Error ? error.message : "Unknown error",
          },
        },
        { status: 500, headers: corsHeaders }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32603,
          message: "Internal error",
          data: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

async function handleListResources(
  message: MCPMessage,
  corsHeaders: Record<string, string>
): Promise<NextResponse> {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        resources: mcpServer.listResources(),
      },
    },
    { headers: corsHeaders }
  );
}

async function handleReadResource(
  message: MCPMessage,
  corsHeaders: Record<string, string>
): Promise<NextResponse> {
  try {
    const { uri } = message.params;

    const context = await buildAuthenticatedContext();
    if (!context) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32603,
            message: "No authenticated user or workspace found",
            data: "Please authenticate and select a workspace first using SPRINTIQ_CHECK_ACTIVE_CONNECTION",
          },
        },
        { status: 401, headers: corsHeaders }
      );
    }

    const result = await mcpServer.readResource(uri, context);

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: message.id,
        result: result,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32603,
          message: "Internal error",
          data: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

async function handleListPrompts(
  message: MCPMessage,
  corsHeaders: Record<string, string>
): Promise<NextResponse> {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        prompts: mcpServer.listPrompts(),
      },
    },
    { headers: corsHeaders }
  );
}

async function handleGetPrompt(
  message: MCPMessage,
  corsHeaders: Record<string, string>
): Promise<NextResponse> {
  try {
    const { name, arguments: args } = message.params;

    const context = await buildAuthenticatedContext();
    if (!context) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32603,
            message: "No authenticated user or workspace found",
            data: "Please authenticate and select a workspace first using SPRINTIQ_CHECK_ACTIVE_CONNECTION",
          },
        },
        { status: 401, headers: corsHeaders }
      );
    }

    const result = await mcpServer.getPrompt(name, args, context);

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: message.id,
        result: result,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32603,
          message: "Internal error",
          data: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle GET requests to return server info
export async function GET(request: NextRequest) {
  const corsHeaders = handleCors(request);

  return NextResponse.json(
    {
      server: mcpServer.info(),
      endpoints: {
        mcp: "/api/mcp/server",
        enhanced: "/api/mcp/enhanced",
      },
      workflows: {
        enhanced: {
          description:
            "Enhanced workflow with user validation and workspace selection",
          usage:
            "Include userEmail in tool call arguments to use enhanced workflow",
          example: {
            method: "tools/call",
            params: {
              name: "generateUserStories",
              arguments: {
                userEmail: "user@example.com",
                featureDescription: "Shopping system management",
                numberOfStories: 3,
                workspaceId: "optional-workspace-id",
                selectedTeamMemberIds: ["optional-team-member-ids"],
              },
            },
          },
        },
        basic: {
          description: "Direct tool calls with explicit context",
          usage: "Provide complete context object with workspaceId and userId",
          example: {
            method: "tools/call",
            params: {
              name: "generateUserStories",
              arguments: {
                featureDescription: "Shopping system management",
                numberOfStories: 3,
                context: {
                  workspaceId: "workspace-id",
                  userId: "user-id",
                  email: "user@example.com",
                },
              },
            },
          },
        },
      },
      documentation: "https://github.com/your-org/sprint-iq/docs/mcp.md",
      status: "healthy",
      timestamp: new Date().toISOString(),
    },
    { headers: corsHeaders }
  );
}
