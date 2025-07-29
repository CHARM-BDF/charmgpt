# Gemini Tools Server

## Overview
The Gemini Tools Server is a specialized service that provides a standardized interface for interacting with Google's Gemini AI models. It serves as a bridge between your application and Gemini's capabilities, offering a consistent way to handle AI interactions across different environments.

## Key Features
- **Standardized Interface**: Provides a consistent API for Gemini model interactions
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

### 2. Configuration
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

### 3. Request/Response Types
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

## Usage Example
Example implementation (`/src/server/services/llm/examples/gemini-usage.ts`):
```typescript
const client = new GeminiClient({
  apiKey: process.env.GEMINI_API_KEY,
  model: 'gemini-pro',
  environment: 'prod'
});

const response = await client.generateContent({
  contents: [{
    parts: [{ text: "Explain quantum computing" }]
  }]
});
```

## Environment Setup
1. Set up environment variables in `.env`:
   ```bash
   GEMINI_API_KEY=your_api_key
   GEMINI_ENVIRONMENT=prod
   ```

2. Install dependencies in `package.json`:
   ```bash
   npm install @google/generative-ai
   ```

## Best Practices
1. Always use environment variables for API keys
2. Implement proper error handling
3. Use appropriate model versions for your use case
4. Monitor API usage and costs
5. Implement rate limiting for production use

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

## Requirements and Limitations

- **Function/Tool Calling**: Function/tool calling is only supported via the official Google Generative AI client libraries (e.g., `@google/generative-ai` for Node.js). The REST API (v1beta) does not support function/tool calling via `functionDeclarations` in the payload.
- **REST API Limitations**: The REST API only supports basic content generation, not tool/function calling, at this time.

## Tool/Function Calling with Gemini

### Overview
Gemini supports function/tool calling via the official Google Generative AI client libraries (e.g., `@google/generative-ai` for Node.js). This allows you to define tools (functions) that the model can call, receive structured arguments, and return results. **This feature is not available via the REST API.**

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

### Tool Calling Request Example
```js
const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: 'Please add 5 and 7.' }] }],
  tools: [{ functionDeclarations: [calculatorTool] }]
});
```

### Tool Calling Response Example
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

### Two-Step Tool Use and Formatting Process
1. **Tool Call Step:**
   - Send a user message and tool definition(s) to Gemini.
   - Gemini responds with a function call and arguments.
   - Your backend executes the tool and collects the result.
2. **Formatting Step:**
   - Send the tool result(s) back to Gemini, along with a formatting tool definition (e.g., `response_formatter`).
   - Ask Gemini to synthesize a final, user-facing response using the tool result(s).
   - Gemini returns a formatted response for the user.

#### Example Formatting Tool Declaration
```js
const responseFormatterTool = {
  name: 'response_formatter',
  description: 'Formats tool results into a user-friendly response',
  parameters: {
    type: 'object',
    properties: {
      toolResult: { type: 'object', description: 'The result from the tool call' }
    },
    required: ['toolResult']
  }
};
```

#### Example Formatting Request
```js
const formatResult = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: 'Format this result for the user.' }] }],
  tools: [{ functionDeclarations: [responseFormatterTool] }],
});
```

### Limitations
- **Function/Tool calling is only available via the official client libraries.**
- **The REST API does not support function/tool calling.** 