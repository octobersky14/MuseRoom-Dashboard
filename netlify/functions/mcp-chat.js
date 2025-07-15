// Try multiple import strategies to handle different module formats
let MCPClient;
try {
  // Try CommonJS require first
  const mcpModule = require("mcp-client-typescript");
  MCPClient = mcpModule.MCPClient || mcpModule.default?.MCPClient || mcpModule;
} catch (error) {
  console.error("Failed to require mcp-client-typescript:", error);
}

exports.handler = async function (event, context) {
  const { message } = JSON.parse(event.body || "{}");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API key not set" }),
    };
  }

  // Validate MCPClient is available
  if (!MCPClient) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "MCPClient not found in module" }),
    };
  }

  const mcp = new MCPClient({ anthropicApiKey: apiKey });
  try {
    const response = await mcp.processQuery(message);
    return {
      statusCode: 200,
      body: JSON.stringify({ response }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
