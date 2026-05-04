/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import {
  MCPClient,
  MCPClientConfig,
  MCPMessage,
  MCPTool,
  MCPServerInfo,
  MCPTransport,
  MCPError,
} from "./types";

export class SprintiQMCPClient implements MCPClient {
  private config: MCPClientConfig | null = null;
  private transport: MCPTransport | null = null;
  private connected = false;
  private requestId = 0;

  async connect(config: MCPClientConfig): Promise<void> {
    this.config = config;
    this.transport = new HttpMCPTransport(config);

    try {
      // Test connection with server info request
      const response = await this.sendMessage({
        jsonrpc: "2.0",
        id: this.generateId(),
        method: "initialize",
        params: {
          protocolVersion: "1.0.0",
          clientInfo: {
            name: "SprintiQ MCP Client",
            version: "1.0.0",
          },
        },
      });

      if (response.error) {
        throw new Error(`Failed to connect: ${response.error.message}`);
      }

      this.connected = true;
    } catch (error) {
      throw new Error(
        `Connection failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      this.transport.close();
      this.transport = null;
    }
    this.connected = false;
    this.config = null;
  }

  async callTool(name: string, params: any): Promise<any> {
    if (!this.connected || !this.transport) {
      throw new Error("Client not connected");
    }

    const response = await this.sendMessage({
      jsonrpc: "2.0",
      id: this.generateId(),
      method: "tools/call",
      params: {
        name,
        arguments: params,
      },
    });

    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }

    return response.result;
  }

  async listTools(): Promise<MCPTool[]> {
    if (!this.connected || !this.transport) {
      throw new Error("Client not connected");
    }

    const response = await this.sendMessage({
      jsonrpc: "2.0",
      id: this.generateId(),
      method: "tools/list",
    });

    if (response.error) {
      throw new Error(`Failed to list tools: ${response.error.message}`);
    }

    return response.result.tools || [];
  }

  async getServerInfo(): Promise<MCPServerInfo> {
    if (!this.connected || !this.transport) {
      throw new Error("Client not connected");
    }

    const response = await this.sendMessage({
      jsonrpc: "2.0",
      id: this.generateId(),
      method: "server/info",
    });

    if (response.error) {
      throw new Error(`Failed to get server info: ${response.error.message}`);
    }

    return response.result;
  }

  async listResources(): Promise<any[]> {
    if (!this.connected || !this.transport) {
      throw new Error("Client not connected");
    }

    const response = await this.sendMessage({
      jsonrpc: "2.0",
      id: this.generateId(),
      method: "resources/list",
    });

    if (response.error) {
      throw new Error(`Failed to list resources: ${response.error.message}`);
    }

    return response.result.resources || [];
  }

  async readResource(uri: string): Promise<any> {
    if (!this.connected || !this.transport) {
      throw new Error("Client not connected");
    }

    const response = await this.sendMessage({
      jsonrpc: "2.0",
      id: this.generateId(),
      method: "resources/read",
      params: { uri },
    });

    if (response.error) {
      throw new Error(`Failed to read resource: ${response.error.message}`);
    }

    return response.result;
  }

  async listPrompts(): Promise<any[]> {
    if (!this.connected || !this.transport) {
      throw new Error("Client not connected");
    }

    const response = await this.sendMessage({
      jsonrpc: "2.0",
      id: this.generateId(),
      method: "prompts/list",
    });

    if (response.error) {
      throw new Error(`Failed to list prompts: ${response.error.message}`);
    }

    return response.result.prompts || [];
  }

  async getPrompt(name: string, args?: any): Promise<any> {
    if (!this.connected || !this.transport) {
      throw new Error("Client not connected");
    }

    const response = await this.sendMessage({
      jsonrpc: "2.0",
      id: this.generateId(),
      method: "prompts/get",
      params: {
        name,
        arguments: args,
      },
    });

    if (response.error) {
      throw new Error(`Failed to get prompt: ${response.error.message}`);
    }

    return response.result;
  }

  private async sendMessage(message: MCPMessage): Promise<MCPMessage> {
    if (!this.transport) {
      throw new Error("Transport not available");
    }

    return await this.transport.send(message);
  }

  private generateId(): number {
    return ++this.requestId;
  }
}

// HTTP Transport implementation
class HttpMCPTransport implements MCPTransport {
  private config: MCPClientConfig;
  private abortController: AbortController;

  constructor(config: MCPClientConfig) {
    this.config = config;
    this.abortController = new AbortController();
  }

  async send(message: MCPMessage): Promise<MCPMessage> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.config.auth) {
      switch (this.config.auth.type) {
        case "bearer":
          headers["Authorization"] = `Bearer ${this.config.auth.token}`;
          break;
        case "apikey":
          headers["X-API-Key"] = this.config.auth.token;
          break;
      }
    }

    try {
      // Set up timeout using AbortController
      const timeoutId = setTimeout(() => {
        this.abortController.abort();
      }, this.config.timeout || 30000);

      const response = await fetch(this.config.serverUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(message),
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result as MCPMessage;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Network error occurred");
    }
  }

  receive(callback: (message: MCPMessage) => void): void {
    // For HTTP transport, we don't implement receive as it's request-response
    // This would be implemented for WebSocket transport
  }

  close(): void {
    this.abortController.abort();
  }
}

// WebSocket Transport implementation (for real-time communication)
class WebSocketMCPTransport implements MCPTransport {
  private config: MCPClientConfig;
  private ws: WebSocket | null = null;
  private messageHandlers: ((message: MCPMessage) => void)[] = [];
  private pendingRequests: Map<
    string | number,
    {
      resolve: (value: MCPMessage) => void;
      reject: (reason?: any) => void;
    }
  > = new Map();

  constructor(config: MCPClientConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.config.serverUrl.replace(/^http/, "ws");
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        resolve();
      };

      this.ws.onerror = (error) => {
        reject(error);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as MCPMessage;
          this.handleMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      this.ws.onclose = () => {
        this.cleanup();
      };
    });
  }

  async send(message: MCPMessage): Promise<MCPMessage> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }

    return new Promise((resolve, reject) => {
      if (message.id) {
        this.pendingRequests.set(message.id, { resolve, reject });
      }

      this.ws!.send(JSON.stringify(message));

      // Set timeout for request
      const timeout = setTimeout(() => {
        if (message.id) {
          this.pendingRequests.delete(message.id);
        }
        reject(new Error("Request timeout"));
      }, this.config.timeout || 30000);

      if (message.id) {
        const originalResolve = this.pendingRequests.get(message.id)!.resolve;
        this.pendingRequests.set(message.id, {
          resolve: (value) => {
            clearTimeout(timeout);
            originalResolve(value);
          },
          reject,
        });
      }
    });
  }

  receive(callback: (message: MCPMessage) => void): void {
    this.messageHandlers.push(callback);
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cleanup();
  }

  private handleMessage(message: MCPMessage): void {
    // Handle response to a request
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve } = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);
      resolve(message);
      return;
    }

    // Handle notifications and other messages
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error("Error in message handler:", error);
      }
    });
  }

  private cleanup(): void {
    // Reject all pending requests
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error("Connection closed"));
    });
    this.pendingRequests.clear();
    this.messageHandlers = [];
  }
}

// MCP Client Manager for managing multiple client connections
export class MCPClientManager {
  private clients: Map<string, SprintiQMCPClient> = new Map();

  async addClient(
    name: string,
    config: MCPClientConfig
  ): Promise<SprintiQMCPClient> {
    const client = new SprintiQMCPClient();
    await client.connect(config);
    this.clients.set(name, client);
    return client;
  }

  getClient(name: string): SprintiQMCPClient | undefined {
    return this.clients.get(name);
  }

  async removeClient(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.disconnect();
      this.clients.delete(name);
    }
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.values()).map((client) =>
      client.disconnect()
    );
    await Promise.all(disconnectPromises);
    this.clients.clear();
  }

  listClients(): string[] {
    return Array.from(this.clients.keys());
  }

  async callToolOnClient(
    clientName: string,
    toolName: string,
    params: any
  ): Promise<any> {
    const client = this.getClient(clientName);
    if (!client) {
      throw new Error(`Client '${clientName}' not found`);
    }
    return await client.callTool(toolName, params);
  }

  async listToolsFromClient(clientName: string): Promise<MCPTool[]> {
    const client = this.getClient(clientName);
    if (!client) {
      throw new Error(`Client '${clientName}' not found`);
    }
    return await client.listTools();
  }

  async getServerInfoFromClient(clientName: string): Promise<MCPServerInfo> {
    const client = this.getClient(clientName);
    if (!client) {
      throw new Error(`Client '${clientName}' not found`);
    }
    return await client.getServerInfo();
  }
}

// Export transport classes for external use
export { HttpMCPTransport, WebSocketMCPTransport };
