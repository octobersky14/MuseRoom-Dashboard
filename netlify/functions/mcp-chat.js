import { MCPClient as NamedExport } from "mcp-client-typescript";
const MCPClient =
  NamedExport ??
  (await import("mcp-client-typescript")).default ??
  (await import("mcp-client-typescript")).MCPClient;

export async function handler(event, context) {
  const { message } = JSON.parse(event.body || "{}");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API key not set" }),
    };
  }

  const mcp = new MCPClient({ anthropicApiKey: apiKey });
  try {
    const response = await mcp.processQuery(message);
    return { statusCode: 200, body: JSON.stringify({ response }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
