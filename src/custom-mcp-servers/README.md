# Custom MCP Servers

This directory contains custom Model Context Protocol (MCP) servers that are specific to this application.

## Directory Structure

```
custom-mcp-servers/
  server-name/
    src/
      index.ts      # Main server entry point
      tools/        # Server tools implementation
      types/        # Type definitions
    package.json    # Server-specific dependencies
    tsconfig.json   # TypeScript configuration
```

## Adding a New Server

1. Create a new directory under `custom-mcp-servers/` with your server name
2. Copy the template structure from an existing server or create from scratch
3. Implement your server functionality in the `src` directory
4. Add your server configuration to `src/config/mcp_server_config.json`

## Building

Custom MCP servers are built as part of the workspace using:
```bash
npm run build:mcp-servers  # Build all custom servers
npm run dev:mcp-servers   # Run servers in development mode
npm run build:all        # Build everything including custom servers
```

## Server Template

Each server should follow the MCP protocol specification and implement:
1. Tool registration
2. Request/response handling
3. Proper error handling and logging
4. TypeScript types for all tools and responses

See the example servers in this directory for reference implementations. 