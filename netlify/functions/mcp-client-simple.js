// mcp-client-simple.js
// A simplified JavaScript implementation of the MCP client for use in Netlify functions
// This version doesn't require TypeScript compilation and works directly with Claude

const { Anthropic } = require('@anthropic-ai/sdk');

/**
 * Simple MCP Client for Netlify Functions
 * This is a lightweight version that only uses Claude directly without MCP server connections
 */
class MCPClient {
  /**
   * Create a new MCP client
   * @param {Object} options - Configuration options
   * @param {string} options.anthropicApiKey - Anthropic API key (optional, will use env var if not provided)
   * @param {string} options.model - Claude model to use (optional, defaults to claude-3-5-sonnet-20241022)
   * @param {number} options.maxTokens - Maximum tokens for responses (optional, defaults to 1000)
   * @param {boolean} options.debug - Enable debug logging (optional, defaults to false)
   */
  constructor(options = {}) {
    // Support both object-style and string-only constructor for backwards compatibility
    let apiKey;
    
    if (typeof options === 'string') {
      // Handle legacy string-only constructor
      apiKey = options;
      this.model = 'claude-3-5-sonnet-20241022';
      this.maxTokens = 1000;
      this.debug = false;
    } else {
      // Handle new object-style constructor
      apiKey = options.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
      this.model = options.model || 'claude-3-5-sonnet-20241022';
      this.maxTokens = options.maxTokens || 1000;
      this.debug = options.debug || false;
    }

    if (!apiKey) {
      const errorMsg = "MCPClient initialization failed: ANTHROPIC_API_KEY missing. " +
        "Provide it via constructor argument or environment variable.";
      this.logError(errorMsg);
      throw new Error("ANTHROPIC_API_KEY is not set");
    }

    // Initialize Anthropic client
    try {
      this.anthropic = new Anthropic({
        apiKey: apiKey,
      });
      
      this.logDebug("MCPClient initialized successfully");
    } catch (error) {
      this.logError("Failed to initialize MCPClient", error);
      throw error;
    }
  }

  /**
   * Process a query using Claude
   * @param {string} query - The user's input query
   * @returns {Promise<string>} - Claude's response
   */
  async processQuery(query) {
    try {
      this.logDebug(`Processing query: ${query}`);
      
      // Create a simple message with the user's query
      const messages = [
        {
          role: "user",
          content: query,
        },
      ];

      // Call Claude API
      this.logDebug(`Calling Claude model: ${this.model}`);
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages,
      });

      // Extract text from response
      let result = '';
      if (response && response.content && response.content.length > 0) {
        for (const content of response.content) {
          if (content.type === 'text') {
            result += content.text;
          }
        }
      }

      this.logDebug(`Query processing complete, response length: ${result.length} chars`);
      return result;
    } catch (error) {
      this.logError("Error processing query:", error);
      throw new Error(`Failed to process query: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Log a debug message if debug mode is enabled
   * @private
   * @param {string} message - Debug message
   * @param {any} data - Optional data to log
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
   * @private
   * @param {string} message - Error message
   * @param {any} error - Optional error object
   */
  logError(message, error) {
    console.error(`[MCP-ERROR] ${message}`);
    if (error) {
      if (error instanceof Error) {
        console.error(`${error.message}\n${error.stack}`);
      } else {
        console.error(error);
      }
    }
  }
}

// Export for both CommonJS and ESM
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = { MCPClient };
} else {
  exports.MCPClient = MCPClient;
}
