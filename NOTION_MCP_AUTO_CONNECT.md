# Notion MCP Auto-Connection Setup

This document explains how the Notion MCP auto-connection feature works in MuseRoom Dashboard.

## Overview

The MuseRoom Dashboard now automatically connects to the Notion MCP server when the app loads, eliminating the need for manual connection setup.

## How It Works

### 1. Configuration File

The app reads the MCP configuration from `public/mcp-config.json`:

```json
{
  "notionMCP": {
    "command": "npx",
    "args": ["-y", "mcp-remote", "https://mcp.notion.com/sse"]
  }
}
```

### 2. Auto-Connection Process

- When the app loads, the `useAIAssistant` hook initializes the MCP client
- After a 2-second delay (to ensure proper initialization), it automatically:
  - Loads the MCP configuration
  - Connects to the "notionMCP" server
  - Updates the UI with connection status and available tools

### 3. UI Status Indicator

The Dashboard now includes a **MCP Status Indicator** that shows:

- Connection status (Connecting, Connected, Error, Disconnected)
- Available tools when connected
- Visual indicators with appropriate colors and icons

## Files Modified

### New Files Created

- `src/utils/mcpConfigLoader.ts` - Utility to load MCP configuration
- `src/components/McpStatusIndicator.tsx` - UI component for status display
- `public/mcp-config.json` - MCP server configuration
- `connect-notion-mcp.js` - Setup script for validation

### Modified Files

- `src/hooks/useAIAssistant.ts` - Added auto-connection logic
- `src/pages/Dashboard.tsx` - Added MCP status indicator

## Usage

### For Users

1. **No manual setup required** - The app automatically connects to Notion MCP
2. **Visual feedback** - The MCP Status Indicator shows connection progress
3. **OAuth flow** - When first connecting, a Notion OAuth window will appear
4. **Tool discovery** - Once connected, all Notion MCP tools are automatically available

### For Developers

1. **Configuration** - Modify `public/mcp-config.json` to add/remove MCP servers
2. **Customization** - The auto-connection logic is in `useAIAssistant.ts`
3. **Status monitoring** - Use the `mcpStatus` and `mcpTools` from the hook

## Troubleshooting

### Connection Issues

- **Check configuration** - Ensure `public/mcp-config.json` exists and is valid
- **Network access** - Verify you have access to `https://mcp.notion.com/sse`
- **Beta access** - Make sure you're whitelisted for Notion MCP beta
- **OAuth issues** - Allow cookies for notion.com in your browser

### Development Issues

- **File location** - Ensure `mcp-config.json` is in the `public/` directory
- **Server restart** - Restart the dev server after configuration changes
- **Console logs** - Check browser console for connection status messages

## Benefits

1. **Zero-config setup** - Works out of the box with proper configuration
2. **Visual feedback** - Users can see connection status immediately
3. **Automatic tool discovery** - All MCP tools are available without manual setup
4. **Error handling** - Graceful fallback if connection fails
5. **Extensible** - Easy to add more MCP servers in the future

## Future Enhancements

- **Multiple servers** - Support for connecting to multiple MCP servers
- **Connection persistence** - Remember successful connections
- **Retry logic** - Automatic reconnection on failure
- **Server selection** - UI to choose which MCP servers to connect to
