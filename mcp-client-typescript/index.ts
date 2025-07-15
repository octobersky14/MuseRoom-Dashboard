import { Anthropic } from "@anthropic-ai/sdk";
import {
  MessageParam,
  Tool,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import readline from "readline/promises";

import dotenv from "dotenv";

/**
 * In many environments (e.g. Netlify functions) the working directory is set up
 * dynamically and environment variables are injected at runtime.  We therefore
 * delay reading `process.env` until inside the class constructor so importing
 * this module never throws.  `.env` is still supported locally for CLI usage.
 */
dotenv.config(); // load environment variables from .env when present

export class MCPClient {
  private mcp: Client;
  private anthropic: Anthropic;
  private transport: StdioClientTransport | null = null;
  private tools: Tool[] = [];

  /**
   * Create a new MCP client.
   *
   * @param apiKey  Optional Anthropic API key.  If not supplied, the key will
   *                be read from the `ANTHROPIC_API_KEY` environment variable.
   */
  constructor(apiKey?: string) {
    const resolvedApiKey = apiKey || process.env.ANTHROPIC_API_KEY;

    if (!resolvedApiKey) {
      /* eslint-disable no-console */
      console.error(
        "MCPClient initialisation failed: ANTHROPIC_API_KEY missing. " +
          "Provide it via constructor argument or environment variable."
      );
      throw new Error("ANTHROPIC_API_KEY is not set");
    }

    // Initialize Anthropic client and MCP client
    this.anthropic = new Anthropic({
      apiKey: resolvedApiKey,
    });

    this.mcp = new Client({ name: "mcp-client-cli", version: "1.0.0" });
  }

  async connectToServer(serverScriptPath: string) {
    /**
     * Connect to an MCP server
     *
     * @param serverScriptPath - Path to the server script (.py or .js)
     */
    try {
      // Determine script type and appropriate command
      const isJs = serverScriptPath.endsWith(".js");
      const isPy = serverScriptPath.endsWith(".py");
      if (!isJs && !isPy) {
        throw new Error("Server script must be a .js or .py file");
      }
      const command = isPy
        ? process.platform === "win32"
          ? "python"
          : "python3"
        : process.execPath;

      // Initialize transport and connect to server
      this.transport = new StdioClientTransport({
        command,
        args: [serverScriptPath],
      });
      this.mcp.connect(this.transport);

      // List available tools
      const toolsResult = await this.mcp.listTools();
      this.tools = toolsResult.tools.map((tool) => {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        };
      });
      console.log(
        "Connected to server with tools:",
        this.tools.map(({ name }) => name)
      );
    } catch (e) {
      console.log("Failed to connect to MCP server: ", e);
      throw e;
    }
  }

  async processQuery(query: string) {
    /**
     * Process a query using Claude and available tools
     *
     * @param query - The user's input query
     * @returns Processed response as a string
     */
    const messages: MessageParam[] = [
      {
        role: "user",
        content: query,
      },
    ];

    // Initial Claude API call
    const response = await this.anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages,
      tools: this.tools,
    });

    // Process response and handle tool calls
    const finalText = [];
    const toolResults = [];

    for (const content of response.content) {
      if (content.type === "text") {
        finalText.push(content.text);
      } else if (content.type === "tool_use") {
        // Execute tool call
        const toolName = content.name;
        const toolArgs = content.input as { [x: string]: unknown } | undefined;

        const result = await this.mcp.callTool({
          name: toolName,
          arguments: toolArgs,
        });
        toolResults.push(result);
        finalText.push(
          `[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`
        );

        // Continue conversation with tool results
        messages.push({
          role: "user",
          content: result.content as string,
        });

        // Get next response from Claude
        const response = await this.anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          messages,
        });

        finalText.push(
          response.content[0].type === "text" ? response.content[0].text : ""
        );
      }
    }

    return finalText.join("\n");
  }

  async chatLoop() {
    /**
     * Run an interactive chat loop
     */
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log("\nMCP Client Started!");
      console.log("Type your queries or 'quit' to exit.");

      while (true) {
        const message = await rl.question("\nQuery: ");
        if (message.toLowerCase() === "quit") {
          break;
        }
        const response = await this.processQuery(message);
        console.log("\n" + response);
      }
    } finally {
      rl.close();
    }
  }

  async cleanup() {
    /**
     * Clean up resources
     */
    await this.mcp.close();
  }
}

async function main() {
  if (process.argv.length < 3) {
    console.log("Usage: node build/index.js <path_to_server_script>");
    return;
  }
  const mcpClient = new MCPClient();
  try {
    await mcpClient.connectToServer(process.argv[2]);
    await mcpClient.chatLoop();
  } finally {
    await mcpClient.cleanup();
    process.exit(0);
  }
}

/**
 * Only run the CLI loop when this file is executed directly.
 *
 * This prevents Netlify Functions (or any other environment that `require`s or
 * `import`s this module) from inadvertently starting the interactive CLI.
 */
const isDirectCliExecution = (() => {
  // process.argv[1] is the entry script path when executed via `node script.js`
  // In ESM, `import.meta.url` is the full file:// URL of the current module.
  if (typeof process === "undefined" || !process.argv?.[1]) {
    return false;
  }
  try {
    const scriptPath = process.argv[1];
    return import.meta.url.endsWith(scriptPath);
  } catch {
    return false;
  }
})();

if (isDirectCliExecution) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}

/**
 * Provide a CommonJS-compatible export so that environments using `require`
 * (e.g. Netlify Functions by default) can access the class without needing a
 * dynamic `import()`.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – `module` is not defined in ESM typings but exists in CJS
if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  module.exports = { MCPClient };
}
