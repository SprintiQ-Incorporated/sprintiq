# MCP (Model Context Protocol) Integration for SprintiQ

This document describes the MCP integration implementation for SprintiQ, which provides a standardized way to interact with external AI services and tools while maintaining proper user authentication and context management.

## Features

### Core MCP Functionality

- **Server Management**: Connect to and manage multiple MCP servers
- **Tool Discovery**: List and search available tools across all connected servers
- **Context Management**: Maintain SprintiQ-specific context for all operations
- **Error Handling**: Comprehensive error handling and logging
- **Health Monitoring**: Monitor connection health for all servers

### Email-Based User Validation

- **User Authentication**: Validate users by email address
- **Database Integration**: Check user existence and approval status
- **Context Creation**: Automatically create SprintiQ context from user data
- **Workspace Access**: Retrieve user's accessible workspaces, projects, and teams
- **Permission Management**: Set appropriate permissions based on user roles

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MCP Service   │    │ User Validation │    │   MCP Client    │
│                 │    │    Service      │    │    Manager      │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ Email Validation│◄───┤ Database Query  │    │ Server Conn.    │
│ Context Creation│    │ User Validation │    │ Tool Discovery  │
│ Tool Execution  │    │ Context Builder │    │ Message Routing │
│ Batch Operations│    │ Permission Mgmt │    │ Error Handling  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## User Validation Flow

1. **Email Input**: User provides email address
2. **Database Check**: System queries `users` table for email
3. **Validation**: Check if user exists and is approved (`allowed = true`)
4. **Context Building**: Retrieve user's workspaces, projects, teams, etc.
5. **Permission Assignment**: Set permissions based on user roles
6. **Tool Execution**: Execute MCP tools with validated context

## Usage Examples

### Basic User Validation

```typescript
import { mcpService } from "@/lib/mcp/service";

// Validate user by email
const validation = await mcpService.validateUserByEmail("user@example.com");

if (validation.isValid && validation.user) {
  console.log("User validated:", validation.user.name);
  console.log("Workspaces:", validation.user.workspaces.length);
} else {
  console.error("Validation failed:", validation.error);
}
```

### Create Context and Execute Tools

```typescript
// Validate user and create context
const { context, error } = await mcpService.validateUserAndCreateContext(
  "user@example.com",
  "w123456789012", // workspace ID (optional)
  "p123456789012", // project ID (optional)
  "s123456789012", // sprint ID (optional)
  "t123456789012" // team ID (optional)
);

if (context) {
  // Execute MCP tool with validated context
  const result = await mcpService.callTool(
    "external-server",
    "generateStories",
    { featureDescription: "User authentication" },
    context
  );
}
```

### Email-Based Tool Execution

```typescript
// Execute tool with email validation (all-in-one)
const result = await mcpService.callToolWithEmail(
  "external-server",
  "generateStories",
  { featureDescription: "User authentication" },
  "user@example.com",
  "w123456789012" // workspace ID
);

if (result.success) {
  console.log("Generated stories:", result.data);
} else {
  console.error("Tool execution failed:", result.error);
}
```

### Enhanced AI Features with Email Validation

```typescript
// Story generation with email validation
const stories = await mcpService.generateStoriesWithMCPAndEmail({
  featureDescription: "User authentication system",
  numberOfStories: 5,
  complexity: "moderate",
  userEmail: "user@example.com",
  workspaceId: "w123456789012",
  projectId: "p123456789012",
});

// Task priority analysis
const priorityAnalysis = await mcpService.analyzeTaskPriorityWithMCPAndEmail({
  taskIds: ["t1", "t2", "t3"],
  userEmail: "user@example.com",
  workspaceId: "w123456789012",
});

// Similar task search
const similarTasks = await mcpService.findSimilarTasksWithMCPAndEmail({
  query: "authentication implementation",
  limit: 10,
  userEmail: "user@example.com",
  workspaceId: "w123456789012",
});
```

### Batch Operations

```typescript
// Execute multiple operations with email validation
const operations = [
  { server: "ai-server", tool: "analyzeTask", params: { taskId: "t1" } },
  { server: "ai-server", tool: "generateTests", params: { taskId: "t1" } },
  { server: "analytics-server", tool: "getMetrics", params: { taskId: "t1" } },
];

const results = await mcpService.executeBatchOperationsWithEmail(
  operations,
  "user@example.com",
  "w123456789012"
);
```

## Error Handling

The service provides comprehensive error handling for various scenarios:

### User Validation Errors

```typescript
const validation = await mcpService.validateUserByEmail("invalid@email.com");

if (!validation.isValid) {
  switch (validation.error) {
    case "User not found. Please join SprintiQ to access these features.":
      // Handle unregistered user
      break;
    case "Account not yet approved. Please wait for admin approval or contact support.":
      // Handle pending approval
      break;
    case "Failed to query user database":
      // Handle database errors
      break;
  }
}
```

### Tool Execution Errors

```typescript
const result = await mcpService.callToolWithEmail(
  "server",
  "tool",
  params,
  "user@example.com"
);

if (!result.success) {
  console.error("Tool execution failed:", result.error);
  console.log("Server:", result.metadata?.server);
  console.log("Tool:", result.metadata?.tool);
  console.log("Timestamp:", result.metadata?.timestamp);
}
```

## Database Schema Requirements

The MCP service requires the following database tables:

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  allowed BOOLEAN DEFAULT FALSE,
  company VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Workspace-Related Tables

- `workspaces`: Workspace information
- `workspace_members`: User-workspace relationships
- `spaces`: Space information within workspaces
- `projects`: Project information within spaces
- `teams`: Team information within workspaces
- `team_members`: User-team relationships

## Security Considerations

1. **User Authorization**: Only approved users (`allowed = true`) can access MCP features
2. **Context Validation**: All operations require valid user context
3. **Workspace Access**: Users can only access workspaces they're members of
4. **Permission-Based Access**: Tool execution respects user permissions
5. **Input Validation**: All inputs are validated before processing

## Configuration

### Environment Variables

```bash
# MCP Server Configuration
MCP_SERVER_URL=https://your-mcp-server.com
MCP_AUTH_TOKEN=your-auth-token

# Database Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
```

### MCP Client Configuration

```typescript
import { mcpService } from "@/lib/mcp/service";

// Connect to external MCP server
await mcpService.connectToServer("ai-server", {
  serverUrl: "https://ai-server.com/mcp",
  auth: {
    type: "bearer",
    token: process.env.MCP_AUTH_TOKEN,
  },
});
```

## Testing

### Unit Tests

```typescript
import { mcpService } from "@/lib/mcp/service";

describe("MCP Service Email Validation", () => {
  it("should validate existing user", async () => {
    const result = await mcpService.validateUserByEmail("test@example.com");
    expect(result.isValid).toBe(true);
    expect(result.user?.workspaces.length).toBeGreaterThan(0);
  });

  it("should reject non-existent user", async () => {
    const result = await mcpService.validateUserByEmail(
      "nonexistent@example.com"
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("User not found");
  });
});
```

### Integration Tests

```typescript
describe("MCP Tool Execution", () => {
  it("should execute tool with email validation", async () => {
    const result = await mcpService.callToolWithEmail(
      "test-server",
      "echo",
      { message: "Hello" },
      "test@example.com"
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});
```

## Performance Considerations

1. **Context Caching**: Consider caching user context to avoid repeated database queries
2. **Batch Operations**: Use batch operations for multiple tool calls
3. **Connection Pooling**: Maintain persistent connections to MCP servers
4. **Rate Limiting**: Implement rate limiting for external MCP calls

## Best Practices

1. **Always validate users** before executing MCP operations
2. **Use specific workspace/project IDs** when possible for better context
3. **Handle errors gracefully** and provide meaningful error messages
4. **Monitor MCP server health** and implement fallback mechanisms
5. **Log all operations** for debugging and audit purposes

## Future Enhancements

1. **Role-Based Access Control**: More granular permissions based on user roles
2. **Context Caching**: Cache user context for better performance
3. **Async Operations**: Support for long-running async operations
4. **Webhook Support**: Real-time notifications from MCP servers
5. **Multi-Tenant Support**: Enhanced isolation for different organizations
