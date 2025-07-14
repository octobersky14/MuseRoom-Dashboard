#!/usr/bin/env node

/**
 * Notion MCP Connection Script
 *
 * This script helps you connect to the Notion MCP server using the generic MCP client.
 * It reads the mcp-config.json file and provides instructions for connecting.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🔗 Notion MCP Connection Setup");
console.log("================================\n");

// Check if mcp-config.json exists
const configPath = path.join(__dirname, "mcp-config.json");
if (!fs.existsSync(configPath)) {
  console.error("❌ mcp-config.json not found!");
  console.log("Please create mcp-config.json with the following content:");
  console.log(`
{
  "notionMCP": {
    "type": "sse",
    "url": "https://mcp.notion.com/sse"
  }
}
  `);
  process.exit(1);
}

// Read and validate the config
try {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  if (!config.notionMCP) {
    console.error("❌ Invalid configuration: notionMCP section not found");
    process.exit(1);
  }

  console.log("✅ Configuration file found and valid");
  console.log(`📋 Server: ${config.notionMCP.url}`);
  console.log(`🔧 Type: ${config.notionMCP.type}\n`);

  console.log("📝 Next Steps:");
  console.log("1. Open your MuseRoom Dashboard in the browser");
  console.log("2. The app will automatically connect to Notion MCP on load");
  console.log("3. Watch the MCP Status Indicator for connection progress");
  console.log("4. Complete the Notion OAuth flow when prompted\n");

  console.log("⚠️  Important Notes:");
  console.log("- You need to be whitelisted for Notion MCP beta access");
  console.log("- The OAuth window will open automatically when you connect");
  console.log("- Make sure to allow cookies for notion.com");
  console.log(
    "- The connection uses Server-Sent Events (SSE) for real-time communication\n"
  );

  console.log("🚀 Ready to connect! Start your development server with:");
  console.log("   npm run dev\n");
} catch (error) {
  console.error("❌ Error reading configuration:", error.message);
  process.exit(1);
}
