# MCP Server Setup for Cursor

The MCP server allows Cursor to query your Daysweeper API.

## Configuration

Create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "daysweeper": {
      "command": "node",
      "args": ["mcp-server-daysweeper/index.ts"],
      "env": {
        "API_BASE": "http://localhost:3000",
        "INTERNAL_API_KEY": "dev_only_key"
      }
    }
  }
}
```

Or if using tsx/ts-node:

```json
{
  "mcpServers": {
    "daysweeper": {
      "command": "tsx",
      "args": ["mcp-server-daysweeper/index.ts"],
      "env": {
        "API_BASE": "http://localhost:3000",
        "INTERNAL_API_KEY": "dev_only_key"
      }
    }
  }
}
```

## Available Tools

- `list_companies` - List companies with optional search query
- `get_route` - Get route details by ID

## Usage

After setup, Cursor can use these tools to query your local API and validate data.
