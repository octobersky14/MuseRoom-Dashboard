import { Anthropic } from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import readline from "readline/promises";
import dotenv from "dotenv";
/**
 * In many environments (e.g. Netlify functions) the working directory is set up
 * dynamically and environment variables are injected at runtime. We therefore
 * delay reading `process.env` until inside the class constructor so importing
 * this module never throws. `.env` is still supported locally for CLI usage.
 */
dotenv.config(); // load environment variables from .env when present
/**
 * MCP Client for connecting to Model Context Protocol servers
 * and processing queries using Claude.
 *
 * This client can be used in both CLI and serverless environments like Netlify Functions.
 */
export class MCPClient {
    mcp;
    anthropic;
    transport = null;
    tools = [];
    isConnected = false;
    model = "claude-3-5-sonnet-20241022";
    maxTokens = 1000;
    debug = false;
    /**
     * Create a new MCP client.
     *
     * @param options Configuration options
     * @param options.anthropicApiKey Optional Anthropic API key. If not supplied, the key will
     *                                be read from the `ANTHROPIC_API_KEY` environment variable.
     * @param options.model Optional model name to use (defaults to claude-3-5-sonnet-20241022)
     * @param options.maxTokens Optional max tokens for responses (defaults to 1000)
     * @param options.debug Optional flag to enable debug logging (defaults to false)
     */
    constructor(options) {
        // Support both object-style and string-only constructor for backwards compatibility
        let resolvedApiKey;
        if (typeof options === 'string') {
            // Handle legacy string-only constructor
            resolvedApiKey = options;
        }
        else {
            // Handle new object-style constructor
            resolvedApiKey = options?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
            this.model = options?.model || this.model;
            this.maxTokens = options?.maxTokens || this.maxTokens;
            this.debug = options?.debug || this.debug;
        }
        if (!resolvedApiKey) {
            const errorMsg = "MCPClient initialization failed: ANTHROPIC_API_KEY missing. " +
                "Provide it via constructor argument or environment variable.";
            this.logError(errorMsg);
            throw new Error("ANTHROPIC_API_KEY is not set");
        }
        // Initialize Anthropic client and MCP client
        try {
            this.anthropic = new Anthropic({
                apiKey: resolvedApiKey,
            });
            this.mcp = new Client({
                name: "mcp-client-typescript",
                version: "1.0.0"
            });
            this.logDebug("MCPClient initialized successfully");
        }
        catch (error) {
            this.logError("Failed to initialize MCPClient", error);
            throw error;
        }
    }
    /**
     * Connect to an MCP server using stdio transport
     *
     * @param serverScriptPath - Path to the server script (.py or .js)
     * @returns Promise that resolves when connected
     * @throws Error if connection fails
     */
    async connectToServer(serverScriptPath) {
        try {
            this.logDebug(`Connecting to MCP server: ${serverScriptPath}`);
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
            this.logDebug(`Using command: ${command} with args: [${serverScriptPath}]`);
            // Initialize transport and connect to server
            this.transport = new StdioClientTransport({
                command,
                args: [serverScriptPath],
            });
            await this.mcp.connect(this.transport);
            this.isConnected = true;
            // List available tools
            const toolsResult = await this.mcp.listTools();
            this.tools = toolsResult.tools.map((tool) => {
                return {
                    name: tool.name,
                    description: tool.description,
                    input_schema: tool.inputSchema,
                };
            });
            this.logDebug(`Connected to server with ${this.tools.length} tools: ${this.tools.map(({ name }) => name).join(", ")}`);
        }
        catch (error) {
            this.isConnected = false;
            this.logError("Failed to connect to MCP server", error);
            throw new Error(`Failed to connect to MCP server: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Process a query using Claude and available tools
     *
     * @param query - The user's input query
     * @returns Processed response as a string
     * @throws Error if processing fails
     */
    async processQuery(query) {
        try {
            this.logDebug(`Processing query: ${query}`);
            // For Netlify functions, we don't require server connection
            // since we're using Claude directly with tools defined in the query
            if (!this.isConnected && this.tools.length === 0) {
                this.logDebug("No server connected, processing query with Claude only");
            }
            const messages = [
                {
                    role: "user",
                    content: query,
                },
            ];
            // Initial Claude API call
            this.logDebug(`Calling Claude with ${this.tools.length} tools available`);
            const response = await this.anthropic.messages.create({
                model: this.model,
                max_tokens: this.maxTokens,
                messages,
                tools: this.tools.length > 0 ? this.tools : undefined,
            });
            // Process response and handle tool calls
            const finalText = [];
            const toolResults = [];
            for (const content of response.content) {
                if (content.type === "text") {
                    finalText.push(content.text);
                }
                else if (content.type === "tool_use") {
                    // Execute tool call
                    const toolName = content.name;
                    const toolArgs = content.input;
                    this.logDebug(`Executing tool: ${toolName} with args:`, toolArgs);
                    function generateUniqueId() {
                        return Math.random().toString(36).substring(2, 11);
                    }
                    try {
                        const result = await this.mcp.callTool({
                            name: toolName,
                            arguments: toolArgs,
                        });
                        toolResults.push(result);
                        finalText.push(`[Tool ${toolName} executed with args ${JSON.stringify(toolArgs)}]`);
                        // Continue conversation with tool results
                        messages.push({
                            role: "assistant",
                            content: [
                                {
                                    id: generateUniqueId(),
                                    type: "tool_use",
                                    name: toolName,
                                    input: toolArgs,
                                },
                            ],
                        });
                        messages.push({
                            role: "user",
                            content: [{ type: "tool_result", tool_use_id: content.id, content: result.content }],
                        });
                        // Get next response from Claude
                        this.logDebug(`Sending tool results back to Claude`);
                        const followUpResponse = await this.anthropic.messages.create({
                            model: this.model,
                            max_tokens: this.maxTokens,
                            messages,
                        });
                        finalText.push(followUpResponse.content[0].type === "text"
                            ? followUpResponse.content[0].text
                            : "");
                    }
                    catch (toolError) {
                        this.logError(`Error executing tool ${toolName}:`, toolError);
                        finalText.push(`[Error executing tool ${toolName}: ${toolError instanceof Error ? toolError.message : String(toolError)}]`);
                        // Inform Claude about the tool error
                        messages.push({
                            role: "user",
                            content: `Error executing tool ${toolName}: ${toolError instanceof Error ? toolError.message : String(toolError)}`,
                        });
                        const errorResponse = await this.anthropic.messages.create({
                            model: this.model,
                            max_tokens: this.maxTokens,
                            messages,
                        });
                        finalText.push(errorResponse.content[0].type === "text"
                            ? errorResponse.content[0].text
                            : "");
                    }
                }
            }
            const result = finalText.join("\n");
            this.logDebug(`Query processing complete, response length: ${result.length} chars`);
            return result;
        }
        catch (error) {
            this.logError("Error processing query:", error);
            throw new Error(`Failed to process query: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Run an interactive chat loop in the console
     * This is used for CLI mode only
     */
    async chatLoop() {
        if (typeof process === "undefined" || typeof readline === "undefined") {
            throw new Error("Chat loop is only available in Node.js environment");
        }
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
                try {
                    const response = await this.processQuery(message);
                    console.log("\n" + response);
                }
                catch (error) {
                    console.error("\nError:", error instanceof Error ? error.message : String(error));
                }
            }
        }
        finally {
            rl.close();
        }
    }
    /**
     * Clean up resources and close connections
     */
    async cleanup() {
        try {
            this.logDebug("Cleaning up MCP client resources");
            if (this.isConnected) {
                await this.mcp.close();
                this.isConnected = false;
            }
        }
        catch (error) {
            this.logError("Error during cleanup:", error);
        }
    }
    /**
     * Get the list of available tools
     * @returns Array of tools
     */
    getTools() {
        return [...this.tools];
    }
    /**
     * Check if connected to an MCP server
     * @returns True if connected
     */
    isServerConnected() {
        return this.isConnected;
    }
    /**
     * Set the Claude model to use
     * @param model Model name
     */
    setModel(model) {
        this.model = model;
    }
    /**
     * Set the maximum tokens for Claude responses
     * @param maxTokens Maximum tokens
     */
    setMaxTokens(maxTokens) {
        this.maxTokens = maxTokens;
    }
    /**
     * Enable or disable debug logging
     * @param enabled Whether debug logging is enabled
     */
    setDebugLogging(enabled) {
        this.debug = enabled;
    }
    /**
     * Log a debug message if debug mode is enabled
     */
    logDebug(message, data) {
        if (this.debug) {
            console.log(`[MCP-DEBUG] ${message}`);
            if (data !== undefined) {
                console.log(data);
            }
        }
    }
    /**
     * Log an error message
     */
    logError(message, error) {
        console.error(`[MCP-ERROR] ${message}`);
        if (error) {
            if (error instanceof Error) {
                console.error(`${error.message}\n${error.stack}`);
            }
            else {
                console.error(error);
            }
        }
    }
}
/**
 * Main entry point for CLI usage
 */
async function main() {
    if (process.argv.length < 3) {
        console.log("Usage: node build/index.js <path_to_server_script>");
        return;
    }
    const mcpClient = new MCPClient();
    try {
        await mcpClient.connectToServer(process.argv[2]);
        await mcpClient.chatLoop();
    }
    catch (error) {
        console.error("Fatal error:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
    finally {
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
    }
    catch {
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
