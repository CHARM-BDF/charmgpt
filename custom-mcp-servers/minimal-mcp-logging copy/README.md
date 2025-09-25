# Minimal MCP Logging Test Environment

This is a minimal test environment for isolating and debugging the MCP logging system. It consists of three components:

1. **Minimal MCP Server**: Generates logs using the MCP SDK
2. **Minimal Main Server**: Receives logs and forwards them to clients
3. **Simple Client**: Displays logs in a browser

## Project Structure

```
minimal-mcp-logging/
├── minimal-mcp/           # MCP server that generates logs
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts
├── minimal-server/        # Main server that receives and forwards logs
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── config.ts      # Configuration for MCP servers
│   │   └── index.ts
└── minimal-client/        # Client that displays logs
    └── index.html
```

## Setup and Installation

1. **Install dependencies for the MCP server**:
   ```bash
   cd minimal-mcp
   npm install
   ```

2. **Install dependencies for the main server**:
   ```bash
   cd ../minimal-server
   npm install
   ```

## Building and Running

1. **Build the MCP server**:
   ```bash
   cd minimal-mcp
   npm run build
   ```

2. **Build the main server**:
   ```bash
   cd ../minimal-server
   npm run build
   ```

3. **Run the test environment** using the start script:
   ```bash
   ./start.sh
   ```
   
   This will:
   - Start the minimal main server on port 3002
   - The main server will spawn the MCP server automatically

4. **Open the client** in your browser:
   ```
   http://localhost:3002
   ```

## Configuration

The test environment uses a configuration file (`minimal-server/src/config.ts`) similar to the main application's `mcp_server_config.json`. This allows you to:

- Configure the port for the main server
- Define MCP servers with their command, arguments, and environment variables
- Add additional test MCP servers if needed

## Features

### MCP Server
- Sends logs at different levels (debug, info, warning, error)
- Includes trace IDs and timestamps
- Adds random metadata to logs

### Main Server
- Spawns and manages MCP servers based on configuration
- Parses log messages from MCP server output
- Forwards logs to connected clients via WebSockets
- Detailed console logging for debugging
- Graceful shutdown of MCP servers

### Client
- Real-time log display
- Filtering by log level
- Expandable metadata
- Auto-reconnection
- Log count statistics

## Debugging

- Check the console output of the main server for detailed logging
- Look for trace IDs to correlate logs across components
- Use the browser's developer tools to debug WebSocket communication

## Customization

- Modify the log generation in `minimal-mcp/src/index.ts`
- Adjust the log handling in `minimal-server/src/index.ts`
- Customize the client display in `minimal-client/index.html`
- Add more MCP servers in `minimal-server/src/config.ts` 