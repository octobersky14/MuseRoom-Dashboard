// MCP Client Service for connecting to MCP servers
// This service provides a generic interface for connecting to any MCP-compliant server

export interface McpConnection {
  type: "stdio" | "sse" | "http";
  url?: string;
  command?: string;
  args?: string[];
  headers?: Record<string, string>;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: any;
  outputSchema?: any;
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpPrompt {
  name: string;
  description: string;
  arguments: any;
}

export interface McpToolResult {
  content: any[];
  isError: boolean;
  error?: string;
}

export interface McpNotification {
  method: string;
  params: any;
}

export interface McpClientOptions {
  name: string;
  version: string;
  onNotification?: (notification: McpNotification) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (
    status: "connecting" | "connected" | "disconnected" | "error"
  ) => void;
}

class McpClientService {
  private connection: McpConnection | null = null;
  private status: "connecting" | "connected" | "disconnected" | "error" =
    "disconnected";
  private tools: McpTool[] = [];
  private resources: McpResource[] = [];
  private prompts: McpPrompt[] = [];
  private options: McpClientOptions;
  private eventSource: EventSource | null = null;
  private messageId = 0;

  constructor(options: McpClientOptions) {
    this.options = options;
  }

  async connect(connection: McpConnection): Promise<void> {
    this.connection = connection;
    this.updateStatus("connecting");

    try {
      if (connection.type === "sse") {
        await this.connectSSE(connection);
      } else if (connection.type === "http") {
        await this.connectHTTP(connection);
      } else if (connection.type === "stdio") {
        await this.connectSTDIO(connection);
      } else {
        throw new Error(`Unsupported connection type: ${connection.type}`);
      }
    } catch (error) {
      this.updateStatus("error");
      throw error;
    }
  }

  private async connectSSE(connection: McpConnection): Promise<void> {
    if (!connection.url) {
      throw new Error("URL is required for SSE connection");
    }

    this.eventSource = new EventSource(connection.url);

    this.eventSource.onopen = () => {
      this.updateStatus("connected");
      this.initializeConnection();
    };

    this.eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      this.updateStatus("error");
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };
  }

  private async connectHTTP(connection: McpConnection): Promise<void> {
    if (!connection.url) {
      throw new Error("URL is required for HTTP connection");
    }

    // For HTTP connections, we'll use polling for now
    // In a real implementation, you might want to use WebSockets or Server-Sent Events
    this.updateStatus("connected");
    this.initializeConnection();
  }

  private async connectSTDIO(connection: McpConnection): Promise<void> {
    // STDIO connections are typically used in Node.js environments
    // For browser-based applications, this would need to be handled differently
    throw new Error(
      "STDIO connections are not supported in browser environments"
    );
  }

  private async initializeConnection(): Promise<void> {
    // Send initialization message
    const initMessage = {
      jsonrpc: "2.0",
      id: this.getMessageId(),
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        clientInfo: {
          name: this.options.name,
          version: this.options.version,
        },
      },
    };

    await this.sendMessage(initMessage);
  }

  private async sendMessage(message: any): Promise<void> {
    if (this.connection?.type === "sse" && this.eventSource) {
      // For SSE, we might need to use a different approach to send messages
      // This is a simplified implementation
      console.log("Sending message:", message);
    }
  }

  private handleMessage(data: any): void {
    if (data.method === "notifications/tools/list") {
      this.tools = data.params.tools || [];
    } else if (data.method === "notifications/resources/list") {
      this.resources = data.params.resources || [];
    } else if (data.method === "notifications/prompts/list") {
      this.prompts = data.params.prompts || [];
    } else if (data.method && this.options.onNotification) {
      this.options.onNotification({
        method: data.method,
        params: data.params,
      });
    }
  }

  private getMessageId(): number {
    return ++this.messageId;
  }

  private updateStatus(
    status: "connecting" | "connected" | "disconnected" | "error"
  ): void {
    this.status = status;
    if (this.options.onStatusChange) {
      this.options.onStatusChange(status);
    }
  }

  async disconnect(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.connection = null;
    this.updateStatus("disconnected");
  }

  async callTool(name: string, args: any): Promise<McpToolResult> {
    if (this.status !== "connected") {
      throw new Error("Not connected to MCP server");
    }

    const message = {
      jsonrpc: "2.0",
      id: this.getMessageId(),
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    };

    try {
      await this.sendMessage(message);
      // In a real implementation, you would wait for the response
      return {
        content: [
          {
            type: "text",
            text: `Tool ${name} called with args: ${JSON.stringify(args)}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [],
        isError: true,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getResource(uri: string): Promise<any> {
    if (this.status !== "connected") {
      throw new Error("Not connected to MCP server");
    }

    const message = {
      jsonrpc: "2.0",
      id: this.getMessageId(),
      method: "resources/read",
      params: { uri },
    };

    try {
      await this.sendMessage(message);
      // In a real implementation, you would wait for the response
      return { uri, content: "Resource content would be here" };
    } catch (error) {
      throw error;
    }
  }

  async getPrompt(name: string, args?: Record<string, any>): Promise<any> {
    if (this.status !== "connected") {
      throw new Error("Not connected to MCP server");
    }

    const message = {
      jsonrpc: "2.0",
      id: this.getMessageId(),
      method: "prompts/get",
      params: { name, arguments: args || {} },
    };

    try {
      await this.sendMessage(message);
      // In a real implementation, you would wait for the response
      return { name, content: "Prompt content would be here" };
    } catch (error) {
      throw error;
    }
  }

  getStatus(): "connecting" | "connected" | "disconnected" | "error" {
    return this.status;
  }

  getTools(): McpTool[] {
    return this.tools;
  }

  getResources(): McpResource[] {
    return this.resources;
  }

  getPrompts(): McpPrompt[] {
    return this.prompts;
  }
}

export default McpClientService;
