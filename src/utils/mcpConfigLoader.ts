import { McpConnection } from "@/services/mcpClientService";

/**
 * Load MCP configuration from mcp-config.json file
 * and convert it to the format expected by the MCP client
 */
export async function loadMcpConfig(): Promise<McpConnection[]> {
  try {
    // Try to fetch the config file
    const response = await fetch("/mcp-config.json");
    if (!response.ok) {
      console.warn("MCP config file not found at /mcp-config.json");
      return [];
    }

    const config = await response.json();
    const connections: McpConnection[] = [];

    // Convert config to MCP connections
    for (const [name, serverConfig] of Object.entries(config)) {
      if (typeof serverConfig === "object" && serverConfig !== null) {
        const config = serverConfig as any;

        if (config.type === "sse" && config.url) {
          // SSE-based MCP server
          connections.push({
            name,
            type: "sse",
            url: config.url,
            headers: config.headers || {},
          });
        } else if (config.type === "http" && config.url) {
          // HTTP-based MCP server
          connections.push({
            name,
            type: "http",
            url: config.url,
            headers: config.headers || {},
          });
        } else if (config.command && config.args) {
          // Legacy stdio-based MCP server (not supported in browser)
          console.warn(
            `Stdio connection for ${name} is not supported in browser environment`
          );
        }
      }
    }

    console.log(`Loaded ${connections.length} MCP connections from config`);
    return connections;
  } catch (error) {
    console.error("Failed to load MCP config:", error);
    return [];
  }
}

/**
 * Get a specific MCP connection by name
 */
export async function getMcpConnection(
  name: string
): Promise<McpConnection | null> {
  const connections = await loadMcpConfig();
  return connections.find((conn) => conn.name === name) || null;
}

/**
 * Check if a specific MCP server is configured
 */
export async function hasMcpServer(name: string): Promise<boolean> {
  const connection = await getMcpConnection(name);
  return connection !== null;
}
