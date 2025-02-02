# Logging Reference

## Log File Location
All detailed logs are written to: `/Users/andycrouse/Documents/GitHub/charm-mcp/logs/detailedserverlog`

## Logging Format
Each log entry follows the format:
```
[TIMESTAMP] [LEVEL] message
```
Where:
- TIMESTAMP is in Central Time (America/Chicago)
- LEVEL is one of: INFO, ERROR, DEBUG
- message contains the actual log content

## Server Initialization Logs

### Startup Phase
```
=== Starting MCP Server Initialization ===
Found MCP servers in config: [server names]
```

### Per-Server Initialization
```
[serverName] Starting server...
[serverName] Connecting with command: [command]
[serverName] Using args: [args]
[serverName] ✅ Server started successfully with N tools: [tool names]
   or
[serverName] ⚠️ Server started but no tools found
   or
[serverName] ❌ Failed to start: [error]
```

### Server Status Summary
```
=== MCP Server Status Summary ===
✅/❌ [serverName]: Running/Failed
Server started at: [timestamp]
API running at http://localhost:[port]
```

## Tool Management Logs

### Tool Name Mapping
```
[DEBUG] Tool name mapping: "[anthropic-name]" -> "[original-name]"
```

### Tool Formatting
```
[DEBUG] === FORMATTED TOOLS FOR CLAUDE ===
[TOOL] [tool.name]
Description: [tool.description]
Input Schema: [schema]
[DEBUG] === END FORMATTED TOOLS ===
```

### Tool Execution
```
[DEBUG] Calling MCP tool: {
  anthropicName: [name],
  originalName: [original],
  serverName: [server],
  toolName: [tool],
  arguments: [args]
}
```

## Chat Processing Logs

### Request Processing
```
[DEBUG] TOOLS BEING SENT TO ANTHROPIC: [tools]
[SERVER] Sending updated conversation to Claude: [details]
[DEBUG] Sending conversation to Claude with tool results: [results]
```

### Response Processing
```
[SERVER] Raw response from Claude: [response]
[SERVER] Tool response input: [input]
[SERVER] Parsed JSON response: [json]
```

### XML Processing
```
[SERVER] Generated XML before validation: [xml]
[SERVER] XML Validation - Input length: [length]
[SERVER] XML Validation - Structure check results: {
  hasResponse: [boolean],
  hasConversation: [boolean]
}
```

## Error Logs

### Tool Errors
```
Error calling tool [name]: [error]
No mapping found for tool name: [name]
No client found for server [server]
Failed to get tools from server [server]: [error]
```

### Request Processing Errors
```
Error processing request: [error]
Failed to process chat message: [error]
```

### XML Validation Errors
```
[SERVER] XML Validation - Parse error: [error]
[SERVER] XML Validation - Error during validation: [error]
```

## Bibliography Handling
```
[DEBUG] Raw bibliography data: [data]
```

## Debug Warnings
```
[DEBUG] WARNING: No tools were formatted!
```

## Notes

1. **Log Levels Usage**
   - INFO: General operational information
   - ERROR: Problems that need attention
   - DEBUG: Detailed information for troubleshooting

2. **Critical Points to Monitor**
   - Server initialization success/failure
   - Tool name mapping accuracy
   - Tool execution results
   - Response formatting and validation

3. **Performance Monitoring**
   - Tool execution timing
   - Response processing timing
   - XML validation timing

4. **Security Considerations**
   - Sensitive data is not logged
   - API keys and credentials are excluded
   - Error messages are sanitized

5. **Maintenance Tips**
   - Regular log rotation
   - Monitor log file sizes
   - Archive old logs periodically 