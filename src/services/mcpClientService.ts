import { EventSourcePolyfill } from "event-source-polyfill";

// MCP Protocol Types
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface McpResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface McpToolResult {
  content?: Array<{
    type: string;
    text?: string;
    data?: any;
  }>;
  isError?: boolean;
  _meta?: Record<string, any>;
}

export interface McpServerCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  logging?: boolean;
}

export interface McpClientOptions {
  name: string;
  version: string;
  onNotification?: (notification: any) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (
    status: "connecting" | "connected" | "disconnected" | "error"
  ) => void;
}

export interface McpConnection {
  type: "stdio" | "sse" | "http";
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

/**
 * Generic MCP Client Service
 *
 * This service can connect to any MCP server and dynamically discover
 * available tools, resources, and prompts. It supports multiple transport
 * methods including stdio, SSE, and HTTP.
 */
export class McpClientService {
  private clientInfo: { name: string; version: string };
  private connection: McpConnection | null = null;
  private eventSource: EventSourcePolyfill | null = null;
  private messageHandlers = new Map<string, (response: any) => void>();
  private messageIdCounter = 0;
  private capabilities: McpServerCapabilities = {};
  private tools = new Map<string, McpTool>();
  private resources = new Map<string, McpResource>();
  private prompts = new Map<string, McpPrompt>();
  private status: "connecting" | "connected" | "disconnected" | "error" =
    "disconnected";
  private childProcess: any = null;

  private onNotification?: (notification: any) => void;
  private onError?: (error: Error) => void;
  private onStatusChange?: (
    status: "connecting" | "connected" | "disconnected" | "error"
  ) => void;

  constructor(options: McpClientOptions) {
    this.clientInfo = {
      name: options.name,
      version: options.version,
    };
    this.onNotification = options.onNotification;
    this.onError = options.onError;
    this.onStatusChange = options.onStatusChange;
  }

  /**
   * Connect to an MCP server
   */
  public async connect(connection: McpConnection): Promise<void> {
    this.connection = connection;
    this.setStatus("connecting");

    try {
      switch (connection.type) {
        case "sse":
          await this.connectSSE(connection);
          break;
        case "http":
          await this.connectHTTP(connection);
          break;
        case "stdio":
          await this.connectStdio(connection);
          break;
        default:
          throw new Error(`Unsupported connection type: ${connection.type}`);
      }

      // Send initialize request
      await this.initialize();

      // Discover server capabilities
      await this.discoverCapabilities();

      this.setStatus("connected");
    } catch (error) {
      this.setStatus("error");
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.childProcess) {
      this.childProcess.kill();
      this.childProcess = null;
    }

    this.messageHandlers.clear();
    this.tools.clear();
    this.resources.clear();
    this.prompts.clear();
    this.capabilities = {};
    this.setStatus("disconnected");
  }

  /**
   * Get current connection status
   */
  public getStatus(): string {
    return this.status;
  }

  /**
   * Get server capabilities
   */
  public getCapabilities(): McpServerCapabilities {
    return this.capabilities;
  }

  /**
   * Get available tools
   */
  public getTools(): McpTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get available resources
   */
  public getResources(): McpResource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get available prompts
   */
  public getPrompts(): McpPrompt[] {
    return Array.from(this.prompts.values());
  }

  /**
   * Call a tool
   */
  public async callTool(name: string, args: any = {}): Promise<McpToolResult> {
    if (!this.tools.has(name)) {
      throw new Error(`Tool "${name}" not found`);
    }

    const request = {
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    };

    const response = await this.sendRequest(request);
    return response.result as McpToolResult;
  }

  /**
   * Read a resource
   */
  public async readResource(uri: string): Promise<any> {
    const request = {
      method: "resources/read",
      params: { uri },
    };

    const response = await this.sendRequest(request);
    return response.result;
  }

  /**
   * Get a prompt
   */
  public async getPrompt(
    name: string,
    args: Record<string, any> = {}
  ): Promise<any> {
    if (!this.prompts.has(name)) {
      throw new Error(`Prompt "${name}" not found`);
    }

    const request = {
      method: "prompts/get",
      params: {
        name,
        arguments: args,
      },
    };

    const response = await this.sendRequest(request);
    return response.result;
  }

  /**
   * Complete a prompt (if server supports sampling)
   */
  public async complete(params: {
    prompt?: { name: string; arguments?: Record<string, any> };
    messages?: Array<{ role: string; content: string }>;
    maxTokens?: number;
    temperature?: number;
  }): Promise<any> {
    const request = {
      method: "completion/complete",
      params,
    };

    const response = await this.sendRequest(request);
    return response.result;
  }

  /**
   * Connect via SSE
   */
  private async connectSSE(connection: McpConnection): Promise<void> {
    if (!connection.url) {
      throw new Error("URL is required for SSE connection");
    }

    this.eventSource = new EventSourcePolyfill(connection.url, {
      headers: {
        "Content-Type": "application/json",
        ...connection.headers,
      },
      withCredentials: true,
    });

    this.eventSource.onopen = () => {
      console.info("Connected to MCP server via SSE");
    };

    this.eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      this.handleError(new Error("SSE connection failed"));
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };
  }

  /**
   * Connect via HTTP (Streamable HTTP Transport)
   */
  private async connectHTTP(connection: McpConnection): Promise<void> {
    if (!connection.url) {
      throw new Error("URL is required for HTTP connection");
    }

    // For HTTP transport, we'll send requests directly
    // No persistent connection needed
  }

  /**
   * Connect via stdio
   */
  private async connectStdio(connection: McpConnection): Promise<void> {
    throw new Error(
      "Stdio connections are not supported in browser environments. Use SSE or HTTP connections instead."
    );
  }

  /**
   * Send initialize request
   */
  private async initialize(): Promise<void> {
    const request = {
      method: "initialize",
      params: {
        protocolVersion: "1.0",
        clientInfo: this.clientInfo,
        capabilities: {
          roots: {},
          sampling: {},
        },
      },
    };

    const response = await this.sendRequest(request);
    if (response.result) {
      this.capabilities = response.result.capabilities || {};
    }
  }

  /**
   * Discover server capabilities by listing tools, resources, and prompts
   */
  private async discoverCapabilities(): Promise<void> {
    // List tools if supported
    if (this.capabilities.tools !== false) {
      try {
        const toolsResponse = await this.sendRequest({ method: "tools/list" });
        if (toolsResponse.result && toolsResponse.result.tools) {
          for (const tool of toolsResponse.result.tools) {
            this.tools.set(tool.name, tool);
          }
        }
      } catch (error) {
        console.warn("Failed to list tools:", error);
      }
    }

    // List resources if supported
    if (this.capabilities.resources !== false) {
      try {
        const resourcesResponse = await this.sendRequest({
          method: "resources/list",
        });
        if (resourcesResponse.result && resourcesResponse.result.resources) {
          for (const resource of resourcesResponse.result.resources) {
            this.resources.set(resource.uri, resource);
          }
        }
      } catch (error) {
        console.warn("Failed to list resources:", error);
      }
    }

    // List prompts if supported
    if (this.capabilities.prompts !== false) {
      try {
        const promptsResponse = await this.sendRequest({
          method: "prompts/list",
        });
        if (promptsResponse.result && promptsResponse.result.prompts) {
          for (const prompt of promptsResponse.result.prompts) {
            this.prompts.set(prompt.name, prompt);
          }
        }
      } catch (error) {
        console.warn("Failed to list prompts:", error);
      }
    }
  }

  /**
   * Send a request to the MCP server
   */
  private async sendRequest(request: any): Promise<any> {
    const id = `req_${Date.now()}_${this.messageIdCounter++}`;
    const message = {
      jsonrpc: "2.0",
      id,
      ...request,
    };

    return new Promise((resolve, reject) => {
      // Set up response handler
      this.messageHandlers.set(id, (response) => {
        if (response.error) {
          reject(new Error(response.error.message || "Request failed"));
        } else {
          resolve(response);
        }
      });

      // Set timeout
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(id);
        reject(new Error("Request timeout"));
      }, 30000);

      // Clear timeout on response
      const originalHandler = this.messageHandlers.get(id)!;
      this.messageHandlers.set(id, (response) => {
        clearTimeout(timeout);
        originalHandler(response);
      });

      // Send message based on connection type
      if (this.connection?.type === "stdio") {
        reject(
          new Error(
            "Stdio connections are not supported in browser environments"
          )
        );
      } else if (this.connection?.type === "sse" && this.eventSource) {
        // For SSE, we need to send via a separate HTTP request
        this.sendSSERequest(message).catch(reject);
      } else if (this.connection?.type === "http") {
        // For HTTP, send directly
        this.sendHTTPRequest(message).then(resolve).catch(reject);
      } else {
        reject(new Error("No active connection"));
      }
    });
  }

  /**
   * Send request via SSE transport
   */
  private async sendSSERequest(message: any): Promise<void> {
    if (!this.connection?.url) return;

    const sendUrl = this.connection.url.replace("/sse", "/messages");
    await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.connection.headers,
      },
      body: JSON.stringify(message),
      credentials: "include",
    });
  }

  /**
   * Send request via HTTP transport
   */
  private async sendHTTPRequest(message: any): Promise<any> {
    if (!this.connection?.url) {
      throw new Error("No URL for HTTP request");
    }

    const response = await fetch(this.connection.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.connection.headers,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`HTTP request failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: any): void {
    // Handle response to a request
    if (message.id && this.messageHandlers.has(message.id)) {
      const handler = this.messageHandlers.get(message.id)!;
      this.messageHandlers.delete(message.id);
      handler(message);
    }

    // Handle notifications
    else if (message.method && !message.id) {
      this.handleNotification(message);
    }
  }

  /**
   * Handle notification from server
   */
  private handleNotification(notification: any): void {
    // Pass to notification handler if provided
    if (this.onNotification) {
      this.onNotification(notification);
    }

    // Handle specific notification types
    switch (notification.method) {
      case "notifications/tools/list_changed":
        // Re-fetch tools list
        this.discoverCapabilities();
        break;
      case "notifications/resources/list_changed":
        // Re-fetch resources list
        this.discoverCapabilities();
        break;
      case "notifications/prompts/list_changed":
        // Re-fetch prompts list
        this.discoverCapabilities();
        break;
      case "notifications/message":
        console.log("MCP server message:", notification.params);
        break;
    }
  }

  /**
   * Set connection status
   */
  private setStatus(
    status: "connecting" | "connected" | "disconnected" | "error"
  ): void {
    this.status = status;
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    console.error("MCP Client Error:", error);
    if (this.onError) {
      this.onError(error);
    }
  }
}

export default McpClientService;
