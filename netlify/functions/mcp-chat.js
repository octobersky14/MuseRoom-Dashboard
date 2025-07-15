// netlify/functions/mcp-chat.js
const mcpModule = require("mcp-client-typescript");
const MCPClient = mcpModule.MCPClient || mcpModule.default || mcpModule;

exports.handler = async function (event, context) {
  const { message } = JSON.parse(event.body || "{}");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API key not set" }),
    };

  try {
    const mcp = new MCPClient({ anthropicApiKey: apiKey });
    const response = await mcp.processQuery(message);
    return { statusCode: 200, body: JSON.stringify({ response }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
