// Fixed MCP Chat Netlify Function
// This function properly imports and uses the MCP client with better error handling

// Import the lightweight JavaScript MCP client that ships with the functions
import { MCPClient } from "./mcp-client-simple.js";

exports.handler = async function (event, context) {
  console.log("MCP Chat function invoked");

  // Check for valid request method
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed. Please use POST." }),
    };
  }

  // Parse message from request body with error handling
  let message;
  try {
    const body = JSON.parse(event.body || "{}");
    message = body.message;
    
    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No message provided in request body" }),
      };
    }
  } catch (err) {
    console.error("Error parsing request body:", err);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set in environment variables");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API key not configured" }),
    };
  }

  try {
    // Set the API key in environment for the MCP client to use
    process.env.ANTHROPIC_API_KEY = apiKey;

    // Create MCP client instance
    // Note: The constructor reads ANTHROPIC_API_KEY from process.env directly
    const mcp = new MCPClient({
    debug: process.env.NODE_ENV === "development",
  });
    
    console.log("Processing query with MCP client");
    const response = await mcp.processQuery(message);
    
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Enable CORS
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: JSON.stringify({ response }),
    };
  } catch (err) {
    console.error("Error in MCP chat function:", err);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Enable CORS
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: JSON.stringify({ 
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }),
    };
  }
};
