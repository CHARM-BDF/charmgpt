# Charm MCP Server Documentation

## Overview
The Charm MCP (Model Context Protocol) Server acts as a bridge between client applications and various MCP-compatible model servers. It integrates with Anthropic's Claude model and manages multiple MCP server instances.

## Core Components

### 1. Server Infrastructure
- Express.js server with CORS support
- Environment configuration via dotenv
- Port configuration (default: 3000)
- XML processing with xml2js

### 2. MCP Integration
- Uses official MCP SDK client
- Supports StdioClientTransport for command-line based communication
- Manages multiple MCP server instances simultaneously
- Maps between Anthropic and MCP tool names

## Type System

### 1. XML Response Structure
```typescript
interface XMLResponse {
  response: {
    error?: string[];         // Optional error messages
    thinking?: string[];      // Optional internal reasoning process
    conversation: string[];   // Required conversation elements
    artifact?: Array<{       // Optional artifacts
      $: {
        type: string;        // Artifact type
        id: string;          // Unique identifier
        title: string;       // Display title
      };
      _: string;            // Artifact content
    }>;
  };
}
```

### 2. Tool Definitions
```typescript
interface AnthropicTool {
  name: string;               
  description: string;        
  input_schema: {            
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface ServerTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}
```

### 3. Response Formatting
```typescript
interface FormatterInput {
  thinking?: string;          
  error?: string;            
  conversation: Array<{
    type: 'text' | 'artifact';
    content?: string;
    artifact?: {
      type: string;          
      id: string;            
      title: string;         
      content: string;       
      language?: string;     
    };
  }>;
}
```

## Server Configuration

### 1. MCP Server Config Structure
```typescript
interface MCPServerConfig {
  command: string;           
  args: string[];           
  env?: Record<string, string>; 
}

interface MCPServersConfig {
  mcpServers: Record<string, MCPServerConfig>;
}
```

### 2. Server Status Tracking
```typescript
interface ServerStatus {
    name: string;            
    isRunning: boolean;      
    tools?: ServerTool[];    
}
```

## Core Functionality

### 1. Message Processing
- Converts between different message formats
- Handles both string content and structured message blocks
- Supports streaming responses
- Manages conversation history

### 2. Tool Management
- Dynamic tool discovery from MCP servers
- Tool name mapping between Anthropic and MCP formats
- Tool execution with error handling
- Support for tool-specific schemas

### 3. Response Formatting
- XML response generation with CDATA sections
- JSON to XML conversion
- XML validation
- Error handling and reporting

### 4. Error Handling
- Comprehensive error capture and formatting
- Error propagation to client
- Detailed error logging
- Stack trace inclusion for debugging

## API Endpoints

### 1. Chat Endpoint (POST /api/chat)
Handles chat interactions with the following flow:
1. Receives message and history
2. Retrieves available tools
3. Makes initial Anthropic call for tool selection
4. Executes selected tools
5. Makes second Anthropic call for final response
6. Formats and returns response

### 2. Server Status Endpoint (GET /api/server-status)
Returns:
- Operational status of each MCP server
- Available tools per server
- Connection state

## Response Processing

### 1. XML Generation
```typescript
function convertJsonToXml(jsonResponse: FormatterInput): string {
  // Generates XML with sections for:
  // - Errors
  // - Thinking process
  // - Conversation
  // - Artifacts
}
```

### 2. Validation
```typescript
async function isValidXMLResponse(response: string): Promise<boolean> {
  // Validates:
  // - Basic XML structure
  // - Required elements
  // - Error section format
  // - Conversation structure
}
```

## Error Handling Capabilities

### 1. Tool Execution Errors
- Detailed error messages
- Stack trace inclusion
- Error categorization
- User-friendly error reporting

### 2. Response Validation Errors
- XML structure validation
- Required element checking
- Format verification
- Error recovery mechanisms

### 3. Server Errors
- Connection error handling
- Configuration error detection
- Runtime error management
- Resource cleanup

## Anthropic Integration

### 1. Model Configuration
- Uses Claude 3.5 Sonnet (2024-10-22)
- Configurable token limits
- Temperature control
- System prompt integration

### 2. Tool Integration
- Tool definition conversion
- Response formatting
- Error handling
- Message history management

## Security Features

### 1. Environment Management
- Secure API key handling
- Environment variable validation
- Configuration isolation
- Sensitive data protection

### 2. Input Validation
- Request validation
- Tool input verification
- XML sanitization
- Error boundary protection

## Logging System

### 1. Error Logging
- Detailed error messages
- Stack trace capture
- Tool execution logging
- Validation error reporting

### 2. Operational Logging
- Server status changes
- Tool execution tracking
- Response processing
- Performance monitoring

## Best Practices

### 1. Tool Usage
- Validate tool availability before execution
- Handle tool execution errors gracefully
- Provide meaningful error messages
- Clean up resources after use

### 2. Response Handling
- Validate response structure
- Handle streaming appropriately
- Process errors consistently
- Maintain conversation context

### 3. Error Management
- Log errors with context
- Provide user-friendly messages
- Include debugging information
- Handle recovery gracefully

## Future Considerations

### 1. Extensibility
- Support for additional MCP servers
- New tool type integration
- Response format evolution
- Error handling enhancement

### 2. Performance
- Response caching
- Tool result optimization
- XML processing efficiency
- Error handling overhead

## Usage Notes

### 1. Server Configuration
- Requires proper environment setup
- MCP server configuration in JSON
- Tool mapping maintenance
- Error handling configuration

### 2. Client Integration
- Expects specific request format
- Handles XML responses
- Processes error messages
- Maintains conversation state

### 3. Maintenance
- Monitor error logs
- Update tool mappings
- Verify server configurations
- Maintain security settings 