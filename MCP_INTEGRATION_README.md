# MCP Integration for MuseRoom AI Assistant

This document describes the changes made to integrate MCP (Model Context Protocol) support into the MuseRoom Dashboard AI Assistant.

## Changes Implemented

### 1. Conversation Flow Fix

- **Issue**: Messages from the prompt box were replacing the entire conversation instead of appending to it
- **Solution**: Modified `VoiceAgent.tsx` to append messages to the existing conversation array instead of replacing it
- **File**: `src/components/VoiceAgent.tsx`
- **Change**: Line 287 changed from `setMessages([userMessage])` to `setMessages((prev) => [...prev, userMessage])`

### 2. MCP Client Implementation

#### New MCP Client Service

- **File**: `src/services/mcpClientService.ts`
- **Features**:
  - Generic MCP client that can connect to any MCP server
  - Supports multiple transport methods: stdio, SSE, and HTTP
  - Automatic tool, resource, and prompt discovery
  - Real-time connection status tracking
  - Error handling and retry logic

#### Updated AI Assistant Hook

- **File**: `src/hooks/useAIAssistant.ts`
- **Changes**:
  - Added MCP client integration
  - New functions for MCP operations:
    - `connectToMcpServer()` - Connect to an MCP server
    - `disconnectFromMcpServer()` - Disconnect from server
    - `callMcpTool()` - Execute an MCP tool
    - `getMcpResource()` - Read an MCP resource
    - `getMcpPrompt()` - Get an MCP prompt
  - Automatic MCP tool discovery and integration
  - Tool results are automatically integrated into AI responses

#### Test Component

- **File**: `src/components/McpConnectionTest.tsx`
- **Purpose**: Example component showing how to connect to MCP servers
- **Features**:
  - Visual connection status
  - Tool discovery and execution
  - Resource and prompt listing

## How to Use MCP Integration

### 1. Connect to an MCP Server

```typescript
const { connectToMcpServer, mcpStatus, mcpTools } = useAIAssistant();

// Connect to an SSE-based MCP server
await connectToMcpServer({
  type: "sse",
  url: "http://localhost:3000/sse",
});

// Connect to a stdio-based MCP server
await connectToMcpServer({
  type: "stdio",
  command: "node",
  args: ["mcp-server.js"],
});
```

### 2. Use MCP Tools

Once connected, the AI assistant will automatically have access to all tools provided by the MCP server. You can:

- List available tools: `mcpTools`
- Call tools directly: `await callMcpTool('toolName', { arg1: 'value' })`
- The AI will automatically use tools when appropriate

### 3. Example MCP Servers

You can connect to any MCP-compliant server. Some examples:

```bash
# Everything server (test server with many tools)
npx @modelcontextprotocol/server-everything

# Filesystem server
npx @modelcontextprotocol/server-filesystem --directory /path/to/dir

# GitHub server
npx @modelcontextprotocol/server-github --token YOUR_GITHUB_TOKEN
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Dashboard     │────▶│  useAIAssistant  │────▶│ MCP Client  │
│  (Prompt Box)   │     │      Hook        │     │   Service   │
└─────────────────┘     └──────────────────┘     └─────────────┘
         │                       │                       │
         │                       ▼                       ▼
         │              ┌──────────────────┐     ┌─────────────┐
         └─────────────▶│   VoiceAgent     │     │ MCP Server  │
                        │  (Chat Display)   │     │  (Tools)    │
                        └──────────────────┘     └─────────────┘
```

## Benefits

1. **Dynamic Integration**: Connect to any MCP server without code changes
2. **Tool Discovery**: Automatically discover and use available tools
3. **Unified Interface**: All MCP tools are available through the same AI assistant
4. **Type Safety**: Full TypeScript support with proper typing
5. **Error Handling**: Robust error handling and connection management

## Future Enhancements

1. **Tool UI**: Add a visual tool palette for manual tool execution
2. **Resource Browser**: Add UI for browsing and viewing MCP resources
3. **Prompt Templates**: Add support for using MCP prompts as conversation starters
4. **Multi-Server**: Support connecting to multiple MCP servers simultaneously
5. **Persistence**: Save MCP server connections for quick reconnection
