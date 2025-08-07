# Gemini Tools Server v2

**Date: May 14, 2025**

## Purpose of this Documentation Update

This document has been updated to reflect important changes to the Gemini Tools implementation. After encountering function calling issues with Gemini 2.0 models, we've enhanced the adapter to properly extract function calls from the new response structure. Previously, our code was looking for function calls at `response.functionCalls?.()` (as a method), but logs showed the actual structure places function results in a different format and location. This documentation consolidates our learnings and implementation changes to work properly with both Gemini 1.5 and 2.0 series models.

## Overview
The Gemini Tools Server is a specialized service that provides a standardized interface for interacting with Google's Gemini AI models. It serves as a bridge between your application and Gemini's capabilities, offering a consistent way to handle AI interactions across different environments and model versions.

## Key Features
- **Standardized Interface**: Provides a consistent API for Gemini model interactions
- **Multi-Version Support**: Compatible with both Gemini 1.5 and 2.0 series models
- **Environment Management**: Handles different Gemini environments (dev/prod) seamlessly
- **Error Handling**: Robust error management and response formatting
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Core Components

### 1. GeminiClient
The main interface for interacting with Gemini models (`/src/server/services/llm/providers/gemini.ts`):
```typescript
class GeminiClient {
  constructor(config: GeminiConfig);
  async generateContent(request: GenerateContentRequest): Promise<GenerateContentResponse>;
  async streamGenerateContent(request: GenerateContentRequest): Promise<AsyncIterable<GenerateContentResponse>>;
}
```

### 2. GeminiToolAdapter
The adapter for handling tool/function calling with Gemini models (`/src/server/services/llm/adapters/gemini.ts`):
```typescript
class GeminiToolAdapter implements ToolCallAdapter {
  convertToolDefinitions(tools: MCPTool[]): any;
  extractToolCalls(response: any): ToolCall[];
  formatToolResults(toolResults: ToolResult[]): any;
  hasFunctionCalls(response: any): boolean;
}
```

### 3. Configuration
Configuration types (`/src/server/services/llm/types/gemini.ts`):
```typescript
interface GeminiConfig {
  apiKey: string;
  model: string;
  environment: 'dev' | 'prod';
  maxRetries?: number;
  timeout?: number;
}
```

### 4. Request/Response Types
Type definitions (`/src/server/services/llm/types/gemini.ts`):
```typescript
interface GenerateContentRequest {
  contents: Content[];
  generationConfig?: GenerationConfig;
  safetySettings?: SafetySetting[];
}

interface GenerateContentResponse {
  candidates: Candidate[];
  promptFeedback?: PromptFeedback;
}
```

## Tool/Function Calling with Gemini

### Response Structure Differences
There are important differences in how function calls are structured in responses between Gemini versions:

#### Gemini 1.5 Response Structure
Function calls are available via a method:
```javascript
response.response.functionCalls()
```

#### Gemini 2.0 Response Structure
Function calls are found in a nested structure:
```javascript
response.candidates[0].content.parts[0].functionCall
```

Our adapter now handles both structures automatically.

### Tool Declaration Example
```js
const calculatorTool = {
  name: 'test_calculator',
  description: 'A simple calculator tool',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide'],
        description: 'The mathematical operation to perform'
      },
      numbers: {
        type: 'array',
        items: { type: 'number' },
        description: 'Numbers to perform operation on'
      }
    },
    required: ['operation', 'numbers']
  }
};
```

### Tool Configuration
When using Gemini 2.0 models, you must include proper tool configuration:

```javascript
// Add function calling configuration
request.config.toolConfig = {
  functionCallingConfig: {
    mode: FunctionCallingConfigMode.ANY,
    allowedFunctionNames: functionNames
  }
};
```

### Tool Calling Request Example
```js
const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: 'Please add 5 and 7.' }] }],
  tools: [{ functionDeclarations: [calculatorTool] }],
  config: {
    toolConfig: {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: ['test_calculator']
      }
    }
  }
});
```

### Tool Calling Response Example (Gemini 2.0)
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "functionCall": {
              "name": "test_calculator",
              "args": {
                "operation": "add",
                "numbers": [5, 7]
              }
            }
          }
        ]
      }
    }
  ]
}
```

## Usage Example
Example implementation with Gemini 2.0:

```typescript
// Initialize the provider
const provider = new GeminiProvider({
  apiKey: process.env.GEMINI_API_KEY,
  model: 'gemini-2.0-flash',
});

// Define tools
const tools = [
  {
    name: 'weather',
    description: 'Get the current weather for a location',
    schema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The location to get weather for'
        }
      },
      required: ['location']
    }
  }
];

// Initialize the adapter
const adapter = new GeminiToolAdapter();

// Convert tools to Gemini format
const geminiTools = adapter.convertToolDefinitions(tools);

// Query with tools
const response = await provider.query(
  'What is the weather in New York?',
  {
    tools: geminiTools,
    toolChoice: { name: 'weather' }
  }
);

// Extract tool calls
if (adapter.hasFunctionCalls(response.rawResponse)) {
  const toolCalls = adapter.extractToolCalls(response.rawResponse);
  console.log('Tool calls:', toolCalls);
}
```

## Environment Setup
1. Set up environment variables in `.env`:
   ```bash
   GEMINI_API_KEY=your_api_key
   GEMINI_ENVIRONMENT=prod
   ```

2. Install dependencies in `package.json`:
   ```bash
   npm install @google/genai
   ```

## Best Practices
1. Always use environment variables for API keys
2. Implement proper error handling
3. Use appropriate model versions for your use case (Gemini 2.0 recommended for tool calling)
4. Monitor API usage and costs
5. Implement rate limiting for production use
6. Test with both model versions if backwards compatibility is needed

## Error Handling
Error response types (`/src/server/services/llm/types/errors.ts`):
```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  }
}
```

Common error codes:
- `INVALID_REQUEST`: Malformed request
- `AUTHENTICATION_ERROR`: API key issues
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `MODEL_ERROR`: Gemini model errors
- `INTERNAL_ERROR`: Server-side issues

## Security Considerations
1. Never expose API keys in client-side code
2. Implement proper authentication
3. Use HTTPS for all communications
4. Monitor for suspicious activity
5. Regular security audits

## Performance Optimization
1. Use streaming for long responses
2. Implement caching where appropriate
3. Monitor response times
4. Use appropriate batch sizes
5. Implement retry logic for failed requests

## Monitoring and Logging
1. Log all API interactions
2. Monitor error rates
3. Track response times
4. Monitor API usage
5. Set up alerts for critical issues

## Troubleshooting
Common issues and solutions:

1. **Function calls not appearing in response**: 
   - Ensure you're using the correct model (Gemini 2.0 recommended)
   - Verify your `functionCallingConfig` is properly set with `mode: 'ANY'`
   - Check function declarations conform to the expected schema format

2. **Error extracting function calls**:
   - Check response structure with detailed logging
   - Verify our adapter is correctly navigating the response structure
   - Ensure the model version in your request matches the response handler

## Future Improvements
1. Enhanced error handling
2. Better rate limiting
3. Improved caching
4. More model options
5. Better documentation

## Contributing
1. Follow the code style guide
2. Write tests for new features
3. Update documentation
4. Submit pull requests
5. Review and test changes

## License
MIT License - See LICENSE file for details 