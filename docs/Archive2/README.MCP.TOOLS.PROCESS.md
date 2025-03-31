# MCP Tools Process Documentation

## Required Imports
```typescript
// Core MCP SDK Imports
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { TextContentSchema } from '@modelcontextprotocol/sdk/types.js';

// Validation
import { z } from 'zod';  // For runtime type validation

// Utilities
import { parseString } from 'xml2js';
import { promisify } from 'util';
```

## Data Structures

### 1. Tool Mapping
```typescript
// Maps Anthropic-friendly tool names to original MCP tool names
const toolNameMapping = new Map<string, string>();
// Example: "pubmed-search" -> "pubmed:search"
```

### 2. Client Storage
```typescript
// Stores MCP client instances for each server
const mcpClients = new Map<string, McpClient>();
```

### 3. Tool Response Schema
```typescript
const toolCallResponseSchema = z.object({
  isError: z.boolean(),
  content: z.array(z.object({
    type: z.string(),
    text: z.string()
  }))
});
```

## Process Flow

### 1. Tool Discovery Phase

#### A. Server Initialization
```typescript
// For each configured server
for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
  // Create client instance
  const client = new McpClient(
    { name: `${serverName}-client`, version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // Connect using StdioClientTransport
  await client.connect(new StdioClientTransport({ 
    command: serverConfig.command,
    args: serverConfig.args,
    env: serverConfig.env
  }));

  // Store client for future use
  mcpClients.set(serverName, client);
}
```

#### B. Tool Collection
```typescript
async function getAllAvailableTools(): Promise<AnthropicTool[]> {
  let mcpTools: AnthropicTool[] = [];
  
  for (const [serverName, client] of mcpClients.entries()) {
    try {
      const toolsResult = await client.listTools();
      
      // Process each tool
      const toolsWithPrefix = toolsResult.tools.map(tool => {
        // Create Anthropic-friendly name
        const originalName = `${serverName}:${tool.name}`;
        const anthropicName = `${serverName}-${tool.name}`
          .replace(/[^a-zA-Z0-9_-]/g, '-');
        
        // Store mapping
        toolNameMapping.set(anthropicName, originalName);
        
        // Convert to Anthropic format
        return {
          name: anthropicName,
          description: tool.description || `Tool for ${tool.name}`,
          input_schema: {
            type: "object",
            properties: resolveSchemaRefs(tool.inputSchema.properties || {}),
            required: tool.inputSchema.required || []
          }
        };
      });
      
      mcpTools = mcpTools.concat(toolsWithPrefix);
    } catch (error) {
      console.error(`Failed to get tools from ${serverName}:`, error);
    }
  }
  
  return mcpTools;
}
```

### 2. Tool Execution Phase

#### A. Tool Selection
```typescript
// First Anthropic call selects tools
const toolSelectionResponse = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: anthMessages,
  tools: formattedTools
});
```

#### B. Tool Execution
```typescript
for (const content of toolSelectionResponse.content) {
  if (content.type === 'tool_use') {
    // Get original tool name
    const originalToolName = toolNameMapping.get(content.name);
    if (!originalToolName) {
      console.error(`No mapping found for tool name: ${content.name}`);
      continue;
    }

    // Split into server and tool names
    const [serverName, toolName] = originalToolName.split(':');
    const client = mcpClients.get(serverName);
    
    try {
      // Execute tool
      const toolResult = await client.callTool({
        name: toolName,
        arguments: content.input || {}
      });

      // Process result
      if (toolResult && typeof toolResult === 'object') {
        if ('content' in toolResult && Array.isArray(toolResult.content)) {
          const textContent = toolResult.content.find(
            (item): item is z.infer<typeof TextContentSchema> => 
              item.type === 'text' && typeof item.text === 'string'
          );
          
          if (textContent) {
            messages.push({
              role: 'user',
              content: [{ type: 'text', text: textContent.text }]
            });
          }
        }
      }
    } catch (error) {
      handleToolError(error, content.name, messages);
    }
  }
}
```

### 3. Error Handling

#### A. Tool Execution Errors
```typescript
function handleToolError(error: unknown, toolName: string, messages: ChatMessage[]) {
  console.error(`Error calling tool ${toolName}:`, error);
  
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const detailedError = error instanceof Error && error.stack 
    ? `\nDetails: ${error.stack}` 
    : '';
  
  messages.push({
    role: 'assistant',
    content: [{ 
      type: 'text', 
      text: `Error executing tool ${toolName}:\n${errorMessage}${detailedError}\n\nPlease try again or rephrase your request.` 
    }]
  });
}
```

#### B. Response Validation
```typescript
function validateToolResponse(response: unknown): boolean {
  try {
    return toolCallResponseSchema.parse(response);
  } catch (error) {
    console.error('Tool response validation failed:', error);
    return false;
  }
}
```

### 4. Response Processing

#### A. Content Extraction
```typescript
function extractToolContent(toolResult: any): string {
  if (!toolResult || typeof toolResult !== 'object') {
    return JSON.stringify(toolResult);
  }

  if ('content' in toolResult && Array.isArray(toolResult.content)) {
    const textContent = toolResult.content.find(
      item => item.type === 'text' && typeof item.text === 'string'
    );
    return textContent ? textContent.text : JSON.stringify(toolResult);
  }

  return JSON.stringify(toolResult);
}
```

#### B. Bibliography Handling
```typescript
function processBibliography(toolResult: any, messages: any[]) {
  if ('bibliography' in toolResult && toolResult.bibliography) {
    messages.bibliography = toolResult.bibliography;
  }
}
```

## Common Tool Types

### 1. Text Processing Tools
```typescript
interface TextProcessingTool {
  type: 'text';
  text: string;
  metadata?: Record<string, unknown>;
}
```

### 2. Resource Tools
```typescript
interface ResourceTool {
  type: 'resource';
  uri: string;
  mimeType: string;
  content?: string;
}
```

### 3. Search Tools
```typescript
interface SearchTool {
  type: 'search';
  query: string;
  filters?: Record<string, unknown>;
  pagination?: {
    offset: number;
    limit: number;
  };
}
```

## Error Types

### 1. Tool Execution Errors
```typescript
interface ToolExecutionError {
  type: 'execution_error';
  toolName: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}
```

### 2. Validation Errors
```typescript
interface ValidationError {
  type: 'validation_error';
  field: string;
  message: string;
  expected: string;
  received: string;
}
```

## Best Practices

### 1. Tool Name Management
- Use consistent naming conventions
- Maintain clear mapping between systems
- Validate tool existence before execution
- Handle name collisions gracefully

### 2. Error Recovery
- Implement exponential backoff for retries
- Provide meaningful error messages
- Log error context for debugging
- Clean up resources on failure

### 3. Response Processing
- Validate response structure
- Handle partial results
- Process metadata appropriately
- Maintain type safety

### 4. Resource Management
- Close connections properly
- Clean up temporary resources
- Monitor memory usage
- Handle timeouts appropriately

## Performance Considerations

### 1. Tool Execution
- Batch similar operations
- Cache frequently used results
- Implement request throttling
- Monitor execution times

### 2. Response Processing
- Stream large responses
- Process results incrementally
- Optimize memory usage
- Handle pagination efficiently

## Security Considerations

### 1. Input Validation
- Sanitize tool inputs
- Validate argument types
- Check access permissions
- Prevent command injection

### 2. Output Processing
- Sanitize tool outputs
- Handle sensitive data
- Validate response formats
- Prevent data leakage

## Debugging Tips

### 1. Tool Execution
- Log tool inputs and outputs
- Track execution time
- Monitor resource usage
- Capture error context

### 2. Response Processing
- Validate response structure
- Check content types
- Monitor transformation steps
- Track data flow

## Common Issues and Solutions

### 1. Tool Connection Issues
```typescript
// Implement connection retry logic
async function connectWithRetry(client: McpClient, config: MCPServerConfig, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await client.connect(new StdioClientTransport(config));
      return true;
    } catch (error) {
      console.error(`Connection attempt ${i + 1} failed:`, error);
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
  return false;
}
```

### 2. Response Validation Issues
```typescript
// Implement response repair mechanisms
function repairToolResponse(response: unknown): any {
  if (!response || typeof response !== 'object') {
    return { type: 'text', text: String(response) };
  }
  
  if (!('content' in response)) {
    return { 
      content: [{ type: 'text', text: JSON.stringify(response) }] 
    };
  }
  
  return response;
}
``` 