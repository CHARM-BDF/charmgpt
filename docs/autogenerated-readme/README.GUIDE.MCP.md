# MCP Server Development Guide

## Overview
This guide outlines how to create a new MCP (Model Control Protocol) server that integrates with the main chat system. MCP servers are specialized microservices that provide tools and capabilities to the main AI system.

## Required Components

### 1. Project Structure
```
your-mcp-server/
├── package.json           # Node.js package configuration
├── tsconfig.json         # TypeScript configuration
├── src/
│   ├── index.ts         # Main server implementation
│   └── formatters.ts    # Response formatters and utilities
├── logs/                # Log directory
└── README.md            # Project documentation
```

### 2. Essential Dependencies
```json
{
  "dependencies": {
    "express": "^4.x.x",
    "typescript": "^5.x.x",
    "cors": "^2.x.x",
    "@types/express": "^4.x.x",
    "@types/node": "^20.x.x"
  }
}
```

## Core Components Implementation

### 1. Tool Definition
Tools are the primary way your MCP server interacts with the main chat system. Each tool must follow this structure:

```typescript
interface Tool {
  name: string;          // Unique identifier for the tool
  description: string;   // Clear description of what the tool does
  parameters: {          // JSON Schema for input parameters
    type: "object",
    properties: {
      // Define your parameters here
    },
    required: string[]   // List of required parameters
  }
}
```

### 2. Response Format
Your MCP server must return responses in this format to integrate with chat.ts:

```typescript
interface MCPResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  logs?: Array<{         // Optional logging information
    level: string;
    message: string;
    timestamp: string;
  }>;
  metadata?: {           // Optional metadata
    querySuccess?: boolean;
    nodeCount?: number;
    message?: string;
  };
  bibliography?: any[];  // Optional bibliography entries
  artifacts?: Array<{    // Optional artifacts (graphs, images, etc.)
    type: string;
    id: string;
    title: string;
    content: string;
    language?: string;
  }>;
  binaryOutput?: {       // Optional binary data
    type: string;
    data: Buffer | string;
    metadata?: Record<string, unknown>;
  };
}
```

## Integration Points

### 1. Server Setup
Your index.ts should implement these key endpoints:

```typescript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Tools listing endpoint
app.get('/tools', (req, res) => {
  res.json({ tools: [/* your tool definitions */] });
});

// Tool execution endpoint
app.post('/tools/:toolName', async (req, res) => {
  // Tool implementation
});
```

### 2. Logging Integration
The main chat system expects logging in this format:

```typescript
interface MCPLogMessage {
  logger?: string;
  level: string;
  data?: {
    message: string;
    [key: string]: unknown;
  };
  timestamp?: string;
}
```

## Communication Flow

1. **Tool Discovery**:
   - Main system queries your MCP server's `/tools` endpoint
   - Your server returns available tools and their schemas

2. **Tool Execution**:
   - Main system sends POST request to `/tools/:toolName`
   - Your server processes the request
   - Returns formatted response with content, artifacts, etc.

3. **Logging**:
   - Your server can send logs during processing
   - Logs are streamed to the main chat interface

## Best Practices

1. **Error Handling**:
   - Always return proper error responses
   - Include meaningful error messages
   - Use appropriate HTTP status codes

2. **Response Formatting**:
   - Keep text responses concise and well-formatted
   - Use markdown for text formatting
   - Include metadata when relevant

3. **Performance**:
   - Implement proper request timeouts
   - Handle concurrent requests appropriately
   - Cache results when possible

4. **Security**:
   - Validate all input parameters
   - Sanitize responses
   - Implement rate limiting if needed

## Common Artifacts Types

- `text/markdown`: Markdown formatted text
- `application/vnd.ant.code`: Code snippets
- `image/svg+xml`: SVG images
- `application/vnd.mermaid`: Mermaid diagrams
- `text/html`: HTML content
- `application/vnd.react`: React components
- `application/vnd.bibliography`: Bibliography entries
- `application/vnd.knowledge-graph`: Knowledge graph data

## Detailed Artifact Handling

### Overview of Artifact Flow
1. MCP Server creates artifact(s)
2. Chat system processes and stores artifacts
3. Final response includes artifacts
4. UI displays artifact links in chat

### Common Artifact Implementation Patterns

#### 1. Bibliography (e.g., PubMed MCP)
```typescript
return {
  content: [{
    type: "text",
    text: `# Search Results for: ${formattedQuery}\n\n${markdownArticles.join("\n\n")}`,
    forModel: true  // This content goes to the LLM
  }],
  bibliography: bibliographyData,  // This becomes an artifact
  isError: false
};
```

#### 2. Markdown Content (e.g., Grant Fetch MCP)
```typescript
return {
  content: [{
    type: "text",
    text: llmVersion,
    forModel: true,
    metadata: {
      url: args.url,
      contentType: fetchResult.contentType,
      statusCode: fetchResult.statusCode
    }
  }],
  grantMarkdown: {
    type: "text/markdown",
    title: "NIH Grant Details",
    content: markdownResult.markdown,
    metadata: {
      source: args.url,
      contentType: fetchResult.contentType,
      convertedAt: new Date().toISOString()
    }
  },
  isError: false
};
```

#### 3. Knowledge Graph (e.g., Medik MCP)
```typescript
return {
  content: [{
    type: "text",
    text: textContent
  }],
  artifacts: [{
    type: "application/vnd.knowledge-graph",
    id: randomUUID(),
    title: "Knowledge Graph",
    content: JSON.stringify(graphData)
  }],
  isError: false
};
```

### Key Implementation Differences

1. **Return Structure Options**:
   - Direct `artifacts` array
   - Top-level `bibliography` array
   - Top-level specific object (e.g., `grantMarkdown`)

2. **Content Format Requirements**:
   - Bibliography: Array of citation objects
   - Markdown: Plain markdown text with metadata
   - Knowledge Graph: JSON stringified graph data
   - Binary Data: Base64 encoded strings

3. **Required Fields for All Artifacts**:
   - Unique ID (use `crypto.randomUUID()`)
   - Type identifier
   - Title
   - Content
   - Position in artifacts array

4. **Optional Fields**:
   - Metadata object for context
   - Language specification
   - Source information
   - Additional type-specific fields

### Best Practices for Artifact Creation

1. **Content Formatting**:
   ```typescript
   // Structured data
   content: JSON.stringify(structuredData)
   
   // Markdown content
   content: markdownText
   
   // Binary data
   content: buffer.toString('base64')
   ```

2. **Metadata Inclusion**:
   ```typescript
   metadata: {
     source: "URL or origin",
     contentType: "MIME type",
     timestamp: new Date().toISOString(),
     // Additional context
   }
   ```

3. **Error Handling**:
   ```typescript
   try {
     // Artifact creation logic
   } catch (error) {
     return {
       content: [{
         type: "text",
         text: "Error creating artifact: " + error.message
       }],
       isError: true
     };
   }
   ```

### UI Integration

Artifacts appear in the chat interface as clickable links:
```html
<button class="artifact-button" data-artifact-id="${id}" data-artifact-type="${type}">
  📎 ${title}
</button>
```

### Common Pitfalls to Avoid

1. **Data Format Issues**:
   - Not stringifying structured data
   - Incorrect base64 encoding
   - Missing required fields

2. **Metadata Problems**:
   - Inconsistent timestamp formats
   - Missing source information
   - Incomplete context

3. **Response Structure**:
   - Mixing different artifact return methods
   - Incorrect content type specification
   - Missing position information

## Testing Your MCP Server

1. **Local Testing**:
   ```bash
   # Start your MCP server
   npm run dev
   
   # Test health endpoint
   curl http://localhost:YOUR_PORT/health
   
   # Test tools endpoint
   curl http://localhost:YOUR_PORT/tools
   
   # Test specific tool
   curl -X POST http://localhost:YOUR_PORT/tools/YOUR_TOOL -d '{"param": "value"}'
   ```

2. **Integration Testing**:
   - Ensure all responses match expected formats
   - Test error scenarios
   - Verify logging functionality
   - Check artifact generation

## Deployment Considerations

1. **Environment Variables**:
   - PORT: Server port number
   - NODE_ENV: Environment (development/production)
   - Any API keys or service credentials

2. **Dependencies**:
   - Keep dependencies up to date
   - Use exact versions in package.json
   - Document any system requirements

3. **Monitoring**:
   - Implement health checks
   - Set up error tracking
   - Monitor performance metrics

## Common Issues and Solutions

1. **Connection Issues**:
   - Verify CORS configuration
   - Check network connectivity
   - Validate port settings

2. **Response Format Errors**:
   - Double-check response structure
   - Validate JSON schemas
   - Test with sample data

3. **Performance Problems**:
   - Implement request caching
   - Optimize database queries
   - Use appropriate timeouts

## Using the LLM Service

The LLM Service provides a standardized way to interact with Large Language Models (like Anthropic's Claude) in your MCP implementation.

### 1. Service Structure

The LLM Service consists of three main components:
- `src/server/services/llm/index.ts`: Core implementation of the service
- `src/server/services/llm/types.ts`: Type definitions
- `src/server/services/llm/providers/anthropic.ts`: Anthropic provider implementation

### 2. Basic Usage

```typescript
import { LLMService } from 'src/server/services/llm';

// Initialize the service
const llmService = new LLMService({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultModel: 'claude-3-haiku-20240307',
  cacheEnabled: true
});

// Make a basic query
const response = await llmService.query({
  messages: [
    {
      role: 'user',
      content: 'What is the capital of France?'
    }
  ]
});

console.log(response.content);
```

### 3. Key Features

#### Caching
The service includes built-in response caching to improve performance and reduce API costs:

```typescript
// Configure caching
const llmService = new LLMService({
  // ... other options
  cacheEnabled: true,
  cacheTTL: 3600 // Cache lifetime in seconds
});
```

#### Specialized Methods

The service provides specialized methods for common tasks:

```typescript
// Extract structured data
const jsonData = await llmService.extractJSON({
  messages: [/* your messages */],
  jsonSchema: {/* your JSON schema */}
});

// Analyze data
const analysis = await llmService.analyze({
  data: yourDataObject,
  task: 'Summarize the key points in this data'
});

// Rank items
const rankedItems = await llmService.rankItems({
  items: ['Item 1', 'Item 2', 'Item 3'],
  criteria: 'Rank by relevance to machine learning'
});
```

### 4. Integration with MCP Tools

When implementing a tool that requires LLM capabilities:

```typescript
// In your tool implementation
app.post('/tools/analysis', async (req, res) => {
  const { data, analysisType } = req.body;
  
  try {
    // Use the LLM service
    const result = await llmService.analyze({
      data,
      task: analysisType
    });
    
    // Format response for MCP
    res.json({
      content: [{
        type: 'text',
        text: result.content
      }],
      isError: false
    });
  } catch (error) {
    res.json({
      content: [{
        type: 'text',
        text: `Error during analysis: ${error.message}`
      }],
      isError: true
    });
  }
});
```

### 5. Provider Configuration

The service currently supports Anthropic's Claude models:

```typescript
// Configure with specific model
const llmService = new LLMService({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultModel: 'claude-3-opus-20240229', // For best quality
  // Alternative models:
  // 'claude-3-sonnet-20240229' - Good balance
  // 'claude-3-haiku-20240307' - Fastest, lowest cost
});
```

### 6. Error Handling

The service includes robust error handling:

```typescript
try {
  const response = await llmService.query({
    messages: [/* your messages */]
  });
  // Process successful response
} catch (error) {
  if (error.name === 'LLMProviderError') {
    // Handle provider-specific errors
  } else if (error.name === 'LLMRateLimitError') {
    // Handle rate limiting
  } else {
    // Handle general errors
  }
}
```

### 7. Best Practices

- Set appropriate timeout values for your use case
- Implement retries for transient errors
- Use structured prompts for consistent results
- Enable caching to improve performance and reduce costs
- Include proper error handling 