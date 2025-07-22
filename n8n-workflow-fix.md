# n8n Workflow Troubleshooting Guide

## Current Issue: "Error in workflow" (500 status)

### Quick Fixes to Try:

#### 1. Simplify AI Agent System Prompt

The current system prompt is very long and complex. Try this simplified version:

```
You are a helpful AI assistant. You can use tools to help users with their requests. When a user asks a question, respond naturally and use tools when needed.
```

#### 2. Check Tool Connections

Make sure all tools are properly connected to the AI Agent:

- Perplexity Ask MCP
- Perplexity Research MCP
- Perplexity Reason MCP
- All Notion tools

#### 3. Test Individual Tools

Test each tool individually to see which one is causing the error:

- Try disabling all tools except one
- Test each tool separately

#### 4. Check Credentials

Verify all API credentials are valid:

- Anthropic API key
- OpenAI API key
- Perplexity API endpoints
- Notion MCP server

#### 5. Memory Configuration

The memory node might be causing issues. Try:

- Disabling memory temporarily
- Using a simpler memory configuration

### Debugging Steps:

1. **Check n8n Execution Logs**

   - Go to your n8n dashboard
   - Find the failed execution
   - Look at the detailed error message

2. **Test with Minimal Workflow**

   - Create a simple test workflow with just:
     - Chat Trigger → AI Agent → Webhook
   - No tools, no memory, just basic chat

3. **Check Tool URLs**
   - Verify all MCP server URLs are accessible
   - Test the Perplexity and Notion endpoints directly

### Expected Workflow Flow:

```
Chat Trigger (GET) → AI Agent → Webhook Response
```

### Common Issues:

- Tool authentication failures
- Memory configuration errors
- System prompt too complex
- MCP server connectivity issues
