# Notion MCP Setup Guide

## What is MCP?

MCP (Model Context Protocol) allows AI assistants like Claude to connect to external tools and services. This setup enables Claude to directly access and manipulate your Notion workspace.

## Configuration Complete ✅

Your Notion MCP server has been configured for Claude Desktop at:
`~/Library/Application Support/Claude/claude_desktop_config.json`

## Configuration Details

```json
{
  "mcpServers": {
    "notionApi": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer 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\", \"Notion-Version\": \"2022-06-28\" }"
      }
    }
  }
}
```

## How to Use

1. **Restart Claude Desktop** if it's currently running
2. **Open Claude Desktop** - you should see MCP tools available
3. **Test the connection** by asking Claude:
   - "Can you list my Notion pages?"
   - "What databases do I have in Notion?"
   - "Create a new page in my Notion workspace"

## Available Commands

Once connected, you can ask Claude to:

### Reading from Notion

- List all pages and databases
- Read content from specific pages
- Search for pages by title or content
- Get database entries and properties

### Writing to Notion

- Create new pages
- Update existing page content
- Add entries to databases
- Modify page properties

### Example Prompts

- "Show me all my Notion pages"
- "Create a new project page called 'MuseRoom Dashboard'"
- "Add a task to my project database"
- "Update the status of my current project"

## Troubleshooting

### If MCP doesn't work:

1. **Check Claude Desktop version** - MCP requires a recent version
2. **Verify the config file** exists at the correct location
3. **Restart Claude Desktop** completely
4. **Check the Notion token** is valid and has proper permissions

### If you get "needs login" in Cursor:

1. **Use Claude Desktop instead** - it has better MCP support
2. **Or** add the same configuration to Cursor's MCP settings

## Security Note

Your Notion token is stored in the configuration file. Keep this file secure and don't share it. The token has access to your entire Notion workspace.

## Next Steps

1. Restart Claude Desktop
2. Test the connection with simple commands
3. Start using Claude to manage your Notion workspace directly!
