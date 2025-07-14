// MCP Configuration Loader
// Utility functions for loading and managing MCP server configurations

export interface McpConfig {
  servers: McpServerConfig[];
  defaultServer?: string;
}

export interface McpServerConfig {
  id: string;
  name: string;
  type: "stdio" | "sse" | "http";
  url?: string;
  command?: string;
  args?: string[];
  headers?: Record<string, string>;
  enabled?: boolean;
}

export interface McpConnection {
  type: "stdio" | "sse" | "http";
  url?: string;
  command?: string;
  args?: string[];
  headers?: Record<string, string>;
}

// Default MCP configuration
const defaultConfig: McpConfig = {
  servers: [
    {
      id: "notion-mcp",
      name: "Notion MCP Server",
      type: "sse",
      url: "https://mcp.notion.com/sse",
      enabled: true,
    },
    {
      id: "filesystem-mcp",
      name: "Filesystem MCP Server",
      type: "stdio",
      command: "npx",
      args: ["@modelcontextprotocol/server-filesystem", "--directory", "."],
      enabled: false,
    },
  ],
  defaultServer: "notion-mcp",
};

/**
 * Load MCP configuration from localStorage or return default
 */
export function loadMcpConfig(): McpConfig {
  try {
    const stored = localStorage.getItem("mcp-config");
    if (stored) {
      const config = JSON.parse(stored);
      return { ...defaultConfig, ...config };
    }
  } catch (error) {
    console.error("Error loading MCP config:", error);
  }
  return defaultConfig;
}

/**
 * Save MCP configuration to localStorage
 */
export function saveMcpConfig(config: McpConfig): void {
  try {
    localStorage.setItem("mcp-config", JSON.stringify(config));
  } catch (error) {
    console.error("Error saving MCP config:", error);
  }
}

/**
 * Get MCP connection configuration by server ID
 */
export function getMcpConnection(serverId: string): McpConnection | null {
  const config = loadMcpConfig();
  const server = config.servers.find((s) => s.id === serverId);

  if (!server || !server.enabled) {
    return null;
  }

  return {
    type: server.type,
    url: server.url,
    command: server.command,
    args: server.args,
    headers: server.headers,
  };
}

/**
 * Get default MCP connection
 */
export function getDefaultMcpConnection(): McpConnection | null {
  const config = loadMcpConfig();
  if (config.defaultServer) {
    return getMcpConnection(config.defaultServer);
  }
  return null;
}

/**
 * Get all enabled MCP servers
 */
export function getEnabledMcpServers(): McpServerConfig[] {
  const config = loadMcpConfig();
  return config.servers.filter((server) => server.enabled);
}

/**
 * Add a new MCP server configuration
 */
export function addMcpServer(server: McpServerConfig): void {
  const config = loadMcpConfig();
  config.servers.push(server);
  saveMcpConfig(config);
}

/**
 * Update an existing MCP server configuration
 */
export function updateMcpServer(
  serverId: string,
  updates: Partial<McpServerConfig>
): void {
  const config = loadMcpConfig();
  const serverIndex = config.servers.findIndex((s) => s.id === serverId);

  if (serverIndex !== -1) {
    config.servers[serverIndex] = {
      ...config.servers[serverIndex],
      ...updates,
    };
    saveMcpConfig(config);
  }
}

/**
 * Remove an MCP server configuration
 */
export function removeMcpServer(serverId: string): void {
  const config = loadMcpConfig();
  config.servers = config.servers.filter((s) => s.id !== serverId);

  // If the removed server was the default, clear the default
  if (config.defaultServer === serverId) {
    config.defaultServer = undefined;
  }

  saveMcpConfig(config);
}

/**
 * Set the default MCP server
 */
export function setDefaultMcpServer(serverId: string): void {
  const config = loadMcpConfig();
  const server = config.servers.find((s) => s.id === serverId);

  if (server) {
    config.defaultServer = serverId;
    saveMcpConfig(config);
  }
}
