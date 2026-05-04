/* eslint-disable @typescript-eslint/no-explicit-any */

// MCP (Model Context Protocol) Types and Interfaces for SprintiQ

export interface MCPMessage {
  jsonrpc: "2.0";
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPCapability {
  name: string;
  description: string;
  inputSchema: any;
  outputSchema: any;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  capabilities: MCPCapability[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: MCPPromptArgument[];
}

export interface MCPPromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

// User Validation Types for MCP
export interface MCPUserValidationResult {
  isValid: boolean;
  user?: MCPValidatedUser;
  error?: string;
}

export interface MCPValidatedUser {
  id: string;
  email: string;
  name: string;
  /** @deprecated No longer used - all authenticated users are allowed */
  allowed?: boolean;
  company?: string;
  workspaces: MCPWorkspaceInfo[];
}

export interface MCPWorkspaceInfo {
  id: string;
  workspace_id: string;
  name: string;
  role: string;
  spaces: MCPSpaceInfo[];
  teams: MCPTeamInfo[];
}

export interface MCPSpaceInfo {
  id: string;
  space_id: string;
  name: string;
  description?: string;
  projects: MCPProjectInfo[];
  sprint_folders: MCPSprintFolderInfo[];
}

export interface MCPProjectInfo {
  id: string;
  project_id: string;
  name: string;
  type?: string;
}

export interface MCPSprintFolderInfo {
  id: string;
  sprint_folder_id: string;
  name: string;
  sprints: MCPSprintInfo[];
}

export interface MCPSprintInfo {
  id: string;
  sprint_id: string;
  name: string;
}

export interface MCPTeamInfo {
  id: string;
  name: string;
  description?: string;
  role?: string;
  level?: string;
}

// SprintiQ specific MCP tool definitions
export interface SprintiQMCPTools {
  // User Management
  SPRINTIQ_VALIDATE_USER: MCPTool;
  SPRINTIQ_GET_USER_CONTEXT: MCPTool;
  SPRINTIQ_CHECK_ACTIVE_CONNECTION: MCPTool;
  SPRINTIQ_GET_AUTHENTICATED_USER: MCPTool;

  // Task Management
  SPRINTIQ_CREATE_TASK: MCPTool;
  // SPRINTIQ_UPDATE_TASK: MCPTool;
  // SPRINTIQ_DELETE_TASK: MCPTool;
  SPRINTIQ_GET_TASK: MCPTool;
  SPRINTIQ_LIST_TASKS: MCPTool;

  // Project Management
  SPRINTIQ_CREATE_PROJECT: MCPTool;
  SPRINTIQ_GET_PROJECT: MCPTool;
  SPRINTIQ_LIST_PROJECTS: MCPTool;

  // Sprint Management
  SPRINTIQ_CREATE_SPRINT: MCPTool;
  SPRINTIQ_GET_SPRINT: MCPTool;
  SPRINTIQ_LIST_SPRINTS: MCPTool;
  SPRINTIQ_GENERATE_SPRINT_GOAL: MCPTool;

  // AI-Native Features
  SPRINTIQ_GENERATE_USER_STORIES: MCPTool;
  SPRINTIQ_ANALYZE_TASK_PRIORITY: MCPTool;
  SPRINTIQ_FIND_SIMILAR_TASKS: MCPTool;
  SPRINTIQ_TRAIN_TAWOS: MCPTool;

  // Team Management
  SPRINTIQ_GET_TEAM_MEMBERS: MCPTool;
  SPRINTIQ_ASSIGN_TASK: MCPTool;
  SPRINTIQ_GET_TEAM_CAPACITY: MCPTool;

  // Analytics
  SPRINTIQ_GET_PROJECT_ANALYTICS: MCPTool;
  SPRINTIQ_GET_SPRINT_ANALYTICS: MCPTool;
  SPRINTIQ_GET_TEAM_PERFORMANCE: MCPTool;

  //Workspace Management
  SPRINTIQ_SELECT_WORKSPACE: MCPTool;
}

// MCP Server Configuration
export interface MCPServerConfig {
  name: string;
  version: string;
  port: number;
  host: string;
  cors?: {
    origin: string[];
    methods: string[];
    headers: string[];
  };
  auth?: {
    type: "bearer" | "apikey" | "oauth";
    required: boolean;
  };
}

// MCP Client Configuration
export interface MCPClientConfig {
  serverUrl: string;
  auth?: {
    type: "bearer" | "apikey" | "oauth";
    token: string;
  };
  timeout?: number;
  retries?: number;
}

// MCP Transport Layer
export interface MCPTransport {
  send(message: MCPMessage): Promise<MCPMessage>;
  receive(callback: (message: MCPMessage) => void): void;
  close(): void;
}

// MCP Server Implementation Interface
export interface MCPServer {
  info(): MCPServerInfo;
  listTools(): MCPTool[];
  callTool(name: string, params: any, context: SprintiQContext): Promise<any>;
  listResources(): MCPResource[];
  readResource(uri: string, context: SprintiQContext): Promise<any>;
  listPrompts(): MCPPrompt[];
  getPrompt(name: string, args: any, context: SprintiQContext): Promise<any>;
}

// MCP Client Implementation Interface
export interface MCPClient {
  connect(config: MCPClientConfig): Promise<void>;
  disconnect(): Promise<void>;
  callTool(name: string, params: any): Promise<any>;
  listTools(): Promise<MCPTool[]>;
  getServerInfo(): Promise<MCPServerInfo>;
}

// SprintiQ Context Types
export interface SprintiQContext {
  workspaceId: string;
  userId: string;
  email: string;
  teamId?: string;
  projectId?: string;
  sprintId?: string;
  permissions: string[];
  workspaceData?: MCPWorkspaceInfo;
}

// MCP Tool Result Types
export interface MCPToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

// MCP Event Types
export interface MCPEvent {
  type: string;
  payload: any;
  timestamp: Date;
  source: string;
}

// MCP Subscription Types
export interface MCPSubscription {
  id: string;
  eventType: string;
  callback: (event: MCPEvent) => void;
  filter?: Record<string, any>;
}
