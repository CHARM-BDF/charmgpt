# MCP Tool Testing Guide

This guide explains how to test the tool functionality in the minimal MCP logging system using curl.

## Available Tools

The minimal MCP system includes the following tools:

1. **Echo Tool** - Echoes back the input message with optional transformation (uppercase)
2. **Calculator Tool** - Performs basic arithmetic operations

## Testing with Curl

### List Available Tools

To get a list of all available tools:

```bash
curl http://localhost:3002/api/tools
```

This will return a JSON object with all registered tools and their schemas.

### Call the Echo Tool

To call the echo tool:

```bash
curl -X POST http://localhost:3002/api/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverName": "test-mcp",
    "toolName": "echo",
    "params": {
      "message": "Hello, MCP!",
      "uppercase": true
    }
  }'
```

This should return:

```json
{
  "result": "HELLO, MCP!"
}
```

To use the echo tool without uppercase transformation:

```bash
curl -X POST http://localhost:3002/api/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverName": "test-mcp",
    "toolName": "echo",
    "params": {
      "message": "Hello, MCP!"
    }
  }'
```

### Call the Calculator Tool

To call the calculator tool for addition:

```bash
curl -X POST http://localhost:3002/api/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverName": "test-mcp",
    "toolName": "calculator",
    "params": {
      "operation": "add",
      "a": 5,
      "b": 3
    }
  }'
```

This should return:

```json
{
  "result": 8
}
```

Other operations:

```bash
# Subtraction
curl -X POST http://localhost:3002/api/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverName": "test-mcp",
    "toolName": "calculator",
    "params": {
      "operation": "subtract",
      "a": 10,
      "b": 4
    }
  }'

# Multiplication
curl -X POST http://localhost:3002/api/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverName": "test-mcp",
    "toolName": "calculator",
    "params": {
      "operation": "multiply",
      "a": 6,
      "b": 7
    }
  }'

# Division
curl -X POST http://localhost:3002/api/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverName": "test-mcp",
    "toolName": "calculator",
    "params": {
      "operation": "divide",
      "a": 20,
      "b": 4
    }
  }'
```

## Viewing Tool Execution Logs

When you call a tool, the system will generate log messages that show the tool was called and with what parameters. These logs will appear in:

1. The browser-based log viewer (http://localhost:3002)
2. The server console output

The logs will include the tool name, the parameters, and the result.

## Error Handling

If you provide invalid parameters or if there's an error during tool execution, the API will return an error response:

```bash
# Division by zero error
curl -X POST http://localhost:3002/api/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverName": "test-mcp",
    "toolName": "calculator",
    "params": {
      "operation": "divide",
      "a": 10,
      "b": 0
    }
  }'
```

This will return an error response:

```json
{
  "error": "Failed to call tool",
  "message": "Division by zero"
}
``` 