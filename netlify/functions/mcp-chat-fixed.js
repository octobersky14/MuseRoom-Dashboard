// Fixed MCP Chat Netlify Function
// This function properly imports and uses the MCP client with better error handling

// Use dynamic import for ES module compatibility
let MCPClient;

exports.handler = async function (event, context) {
  console.log("MCP Chat function invoked");

  // Resolve absolute path to the local built MCP client implementation
  // The file lives at: projectRoot/mcp-client-typescript/dist/index.js
  // From this function file (netlify/functions/*) we need to go two levels up
  const localMcpPath = new URL(
    "../../mcp-client-typescript/dist/index.js",
    import.meta.url
  ).pathname;
  
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
    
    // Dynamically import the MCP client (works with ES modules)
    if (!MCPClient) {
      try {
        // Prefer the *local* build (handles both ESM & CJS exports)
        const esmModule = await import(localMcpPath);
        MCPClient =
          esmModule.MCPClient ||
          esmModule.default?.MCPClient ||
          esmModule.default ||
          esmModule;
      } catch (importErr) {
        console.warn(
          "ES module import failed, falling back to CommonJS require:",
          importErr?.message || importErr
        );
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const cjsModule = require(localMcpPath);
          MCPClient =
            cjsModule.MCPClient ||
            cjsModule.default?.MCPClient ||
            cjsModule.default ||
            cjsModule;
        } catch (cjsErr) {
          console.error(
            "CommonJS require also failed for local MCP client:",
            cjsErr?.message || cjsErr
          );
          throw cjsErr;
        }
      }
    }

    if (!MCPClient) {
      throw new Error("Failed to import MCPClient from mcp-client-typescript");
    }

    // Create MCP client instance
    // Note: The constructor reads ANTHROPIC_API_KEY from process.env directly
    const mcp = new MCPClient();
    
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
