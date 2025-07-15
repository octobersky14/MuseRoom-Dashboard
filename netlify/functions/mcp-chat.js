// netlify/functions/mcp-chat.js
import { MCPClient as Named } from "mcp-client-typescript";

// Fallbacks for the various bundle shapes esbuild sometimes produces
const MCPClient =
  Named ??
  (await import("mcp-client-typescript")).default ??
  (await import("mcp-client-typescript")).MCPClient;

export async function handler(event, context) {
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
}
