# Remote MCP Server Support

This document explains how to configure and use remote MCP servers alongside your local servers.

## Overview

The MCP service now supports both local and remote MCP servers:

- **Local Servers**: Traditional spawned processes using stdio transport
- **Remote Servers**: External servers accessed via SSE (Server-Sent Events) or WebSocket transports

## Configuration

### Basic Remote Server Configuration

Add remote servers to your `mcp_server_config.json`:

```json
{
  "mcpServers": {
    "local-server": {
      "command": "node",
      "args": ["../custom-mcp-servers/pubmed-mcp/dist/index.js"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    },
    "remote-server": {
      "type": "remote",
      "transport": "sse",
      "url": "https://remote-mcp-server.example.com/sse",
      "timeout": 30000
    }
  }
}
```

### Configuration Options

#### Local Server (Backward Compatible)
```json
{
  "server-name": {
    "type": "local",  // Optional, defaults to local
    "command": "node",
    "args": ["path/to/server.js"],
    "env": {
      "ENV_VAR": "value"
    },
    "timeout": 10000  // Optional, defaults to 10s
  }
}
```

#### Remote Server
```json
{
  "server-name": {
    "type": "remote",
    "transport": "sse",  // or "websocket"
    "url": "https://remote-server.com/sse",
    "timeout": 30000,    // Optional, defaults to 30s for remote
    "auth": {            // Optional authentication
      "type": "bearer",  // "bearer", "api-key", or "header"
      "token": "your-token"
    }
  }
}
```

### Authentication Options

#### Bearer Token
```json
{
  "auth": {
    "type": "bearer",
    "token": "your-bearer-token"
  }
}
```

#### API Key (Query Parameter)
```json
{
  "auth": {
    "type": "api-key",
    "apiKey": "your-api-key"
  }
}
```

#### Custom Header
```json
{
  "auth": {
    "type": "header",
    "headerName": "X-API-Key",
    "headerValue": "your-api-key"
  }
}
```

## Transport Types

### SSE (Server-Sent Events)
- **Best for**: One-way communication from server to client
- **URL Format**: `https://server.com/sse`
- **Protocol**: HTTP with EventSource

### WebSocket
- **Best for**: Bidirectional real-time communication
- **URL Format**: `wss://server.com/ws` or `ws://server.com/ws`
- **Protocol**: WebSocket with MCP subprotocol

## Implementation Details

### Transport Factory
The `TransportFactory` class automatically selects the appropriate transport:

- **Local**: Uses `StdioClientTransport` for spawned processes
- **Remote SSE**: Uses `SSEClientTransport` for Server-Sent Events
- **Remote WebSocket**: Uses `WebSocketClientTransport` for WebSocket connections

### Error Handling
- Connection timeouts (configurable per server)
- Graceful fallback when remote servers are unavailable
- Detailed logging for debugging connection issues

### Logging
Remote server connections are logged with clear indicators:
```
[TransportFactory] Creating remote sse transport for server-name at https://...
[SETUP] ✅ Connected to server-name (remote) with official MCP logging support
```

## Testing

### Test Remote Server
The configuration includes a test remote server:

```json
{
  "remote-test-server": {
    "type": "remote",
    "transport": "sse",
    "url": "https://remote-mcp-server.metareflective.app/sse",
    "timeout": 30000
  }
}
```

### Verification
Check server logs for successful connections:
```bash
tail -f logs/server-*.log | grep -E "(remote|TransportFactory)"
```

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Increase timeout value
   - Check network connectivity
   - Verify URL is correct

2. **Authentication Failures**
   - Verify auth configuration
   - Check API keys/tokens
   - Review server-side auth requirements

3. **Transport Errors**
   - Ensure transport type matches server
   - Check CORS settings for web-based servers
   - Verify protocol (http/https, ws/wss)

### Debug Logging
Enable debug logging by setting `DEBUG = true` in `src/services/mcp.ts`.

## Migration Guide

### From Local to Remote
To migrate a local server to remote:

1. **Before** (Local):
```json
{
  "my-server": {
    "command": "node",
    "args": ["./my-server/dist/index.js"]
  }
}
```

2. **After** (Remote):
```json
{
  "my-server": {
    "type": "remote",
    "transport": "sse",
    "url": "https://my-remote-server.com/sse"
  }
}
```

### Hybrid Configuration
You can run both local and remote servers simultaneously:

```json
{
  "mcpServers": {
    "local-pubmed": {
      "command": "node",
      "args": ["./local-servers/pubmed/index.js"]
    },
    "remote-weather": {
      "type": "remote",
      "transport": "sse",
      "url": "https://weather-mcp.example.com/sse"
    },
    "remote-finance": {
      "type": "remote",
      "transport": "websocket",
      "url": "wss://finance-mcp.example.com/ws"
    }
  }
}
```

## Security Considerations

1. **Use HTTPS/WSS**: Always use secure connections for remote servers
2. **Authentication**: Implement proper authentication for remote access
3. **Network Security**: Consider VPN or private networks for sensitive data
4. **Rate Limiting**: Implement rate limiting on remote servers
5. **Input Validation**: Validate all inputs on both client and server sides

## Future Enhancements

- Support for additional transport protocols
- Advanced authentication methods (OAuth, JWT)
- Load balancing for multiple remote server instances
- Health checking and automatic failover
- Caching for improved performance
