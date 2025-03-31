# MCP Logging System: Data Flow Documentation

This document explains the data flow in the minimal MCP logging system, which consists of three main components:

1. **MCP Tool** - Generates logs
2. **MCP Server** - Processes logs and forwards them to clients
3. **Web Client** - Displays logs in real-time

## System Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│             │     │             │     │             │
│   MCP Tool  │────▶│  MCP Server │────▶│ Web Client  │
│             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Components and Data Flow

### 1. MCP Tool (`minimal-mcp/src/index.ts`)

The MCP tool is responsible for generating logs that will be processed by the server.

**Key Functions:**

- `sendLog(level, message, metadata)`: Creates and sends a log message with the specified level, message text, and optional metadata.
- `main()`: Initializes the MCP server, connects to the transport, and sets up timers to generate different types of logs at regular intervals.

**Data Flow:**
1. The tool initializes a Model Context Protocol (MCP) server with logging capabilities
2. It connects to a `StdioServerTransport` for communication
3. It generates logs at regular intervals with different severity levels (debug, info, warning, error)
4. Each log includes:
   - Log level
   - Message text
   - Timestamp
   - Trace ID (for tracking)
   - Optional metadata

### 2. MCP Server (`minimal-server/src/index.ts`)

The server acts as a bridge between the MCP tool and web clients, processing logs and forwarding them to connected clients.

**Key Functions:**

- `initializeMCPServers()`: Starts MCP server processes based on the configuration.
- `handleLogMessage(message)`: Processes log messages received from MCP tools and forwards them to connected clients.
- `cleanup()`: Gracefully shuts down MCP server processes.

**Data Flow:**
1. The server initializes an Express app and WebSocket server
2. It spawns MCP tool processes based on the configuration in `config.ts`
3. It captures stdout/stderr from the MCP processes
4. When it detects a log message in the output:
   - It parses the JSON message
   - It formats the message for client consumption
   - It broadcasts the message to all connected WebSocket clients
5. It also handles client connections/disconnections and cleanup on shutdown

### 3. Web Client (`minimal-client/index.html`)

The web client provides a user interface for viewing logs in real-time.

**Key Features:**

- WebSocket connection to the server
- Real-time log display with different styling based on log level
- Filtering capabilities to show only logs of certain severity levels
- Expandable metadata for detailed information
- Connection status indicator

**Data Flow:**
1. The client establishes a WebSocket connection to the server
2. It receives log messages in JSON format
3. It processes and displays logs with appropriate styling based on log level
4. It provides filtering capabilities to show only logs of certain severity levels
5. It handles connection status and reconnection attempts

## Configuration (`minimal-server/src/config.ts`)

The configuration file defines:

- Server settings (port, log level)
- MCP server configurations (command, arguments, environment variables)

## Complete Data Flow

1. **Log Generation**:
   - MCP tool generates a log with level, message, and metadata
   - Log is sent via the MCP protocol over stdio

2. **Log Processing**:
   - Server captures the stdout from the MCP process
   - Server parses the JSON message from the output
   - Server formats the message for client consumption

3. **Log Distribution**:
   - Server broadcasts the formatted log to all connected WebSocket clients

4. **Log Display**:
   - Web client receives the log message via WebSocket
   - Client renders the log with appropriate styling based on log level
   - Client applies any active filters
   - Client displays the log in the UI

## Sequence Diagram

```
┌─────────┐          ┌─────────┐          ┌─────────┐
│ MCP Tool │          │  Server │          │  Client │
└────┬────┘          └────┬────┘          └────┬────┘
     │                     │                     │
     │ Generate Log        │                     │
     ├────────────────────▶│                     │
     │                     │                     │
     │                     │ Format & Forward    │
     │                     ├────────────────────▶│
     │                     │                     │
     │                     │                     │ Display Log
     │                     │                     │ ──┐
     │                     │                     │   │
     │                     │                     │ ◀─┘
     │                     │                     │
```

## Comparison with Full MCP Implementation (`src/server/services/mcp.ts`)

The minimal MCP logging system and the full implementation in `mcp.ts` differ in several key aspects regarding how they handle communication:

### Transport Implementation Differences

1. **Direction of Communication**:
   - **Minimal Model**: Uses `StdioServerTransport` in the MCP tool, acting as a server that sends logs
   - **Full Implementation**: Uses `StdioClientTransport` in the MCPService, acting as a client that connects to MCP servers

2. **Connection Setup**:
   - **Minimal Model**: 
     - Simpler setup where the MCP tool initializes a server and connects to a transport
     - Direct stdio communication with the parent process
   - **Full Implementation**: 
     - More complex setup with a `MCPService` class that manages multiple MCP clients
     - Spawns child processes for each MCP server and connects to them

3. **Log Handling**:
   - **Minimal Model**:
     - Direct parsing of stdout in the server to detect log messages
     - Simple JSON parsing to extract log data
   - **Full Implementation**:
     - Uses both notification handlers and direct stdout parsing
     - More robust error handling and tracing
     - Supports a wider range of log levels (includes critical, alert, emergency)

4. **Architecture**:
   - **Minimal Model**:
     - Single MCP tool instance sending logs to a server
     - Server directly forwards logs to web clients
   - **Full Implementation**:
     - Multiple MCP server instances managed by the MCPService
     - Centralized log message handler that can be configured
     - Integration with a larger system (supports tools in addition to logging)

### Code Structure Differences

1. **Minimal Model**:
   ```typescript
   // MCP Tool (Server)
   const server = new Server(
     { name: 'test-mcp', version: '1.0.0' },
     { capabilities: { logging: {} } }
   );
   const transport = new StdioServerTransport();
   await server.connect(transport);
   ```

2. **Full Implementation**:
   ```typescript
   // MCPService (Client)
   const client = new McpClient(
     { name: serverName, version: '1.0.0' },
     { capabilities: { tools: {}, logging: {} } }
   );
   await client.connect(new StdioClientTransport({ 
     command: serverConfig.command,
     args: modifiedArgs,
     env: { ...serverConfig.env, ...process.env }
   }));
   ```

The full implementation provides a more robust, scalable architecture designed to handle multiple MCP servers with both logging and tool capabilities, while the minimal model focuses specifically on demonstrating the logging data flow in a simpler, more focused implementation.

This minimal MCP logging system demonstrates a complete end-to-end flow of log data from generation to display, using the Model Context Protocol for standardized logging. 