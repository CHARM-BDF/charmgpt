# LLM and MCP Data Structures for current Anthropic process

This document outlines the data structures used in the communication between the LLM (Claude) and the MCP (Model Context Protocol) server.

## 1. Tool Calling Step Format

### Input to Anthropic SDK
```typescript
{
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 4000,
  messages: [
    // Converted chat history + current message
    { role: 'user', content: string },
    { role: 'assistant', content: string },
    // ... more history
  ],
  temperature: 0.7,
  tools: [
    {
      name: string,          // e.g. "serverName-toolName"
      description: string,   // Tool description
      input_schema: {
        type: "object",
        properties: Record<string, unknown>,
        required?: string[]
      }
    }
    // ... more tools
  ]
}
```

### Output from Anthropic (Tool Use Response)
```typescript
{
  content: [
    {
      type: 'tool_use',
      name: string,          // The tool that was used
      input: Record<string, unknown>  // Tool-specific arguments
    }
  ]
}
```

### After Tool Execution, Added to Messages
```typescript
[
  // Previous messages...
  {
    role: 'assistant',
    content: [
      { 
        type: 'text', 
        text: `Tool used: ${toolName}\nArguments: ${JSON.stringify(arguments)}` 
      }
    ]
  },
  {
    role: 'user',
    content: [
      { 
        type: 'text', 
        text: toolResult.content[0].text  // Tool execution result
      }
    ]
  }
]
```

## 2. Final Response Formatting Step

### Input to Anthropic SDK
```typescript
{
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 4000,
  messages: [/* All previous messages including tool interactions */],
  system: systemPrompt,
  temperature: 0.7,
  tools: [{
    name: "response_formatter",
    description: "Format all responses in a consistent JSON structure",
    input_schema: {
      type: "object",
      properties: {
        thinking: {
          type: "string",
          description: "Optional internal reasoning process"
        },
        conversation: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["text", "artifact"]
              },
              content: {
                type: "string"  // Markdown formatted text
              },
              artifact: {
                type: "object",
                properties: {
                  type: { 
                    type: "string",
                    enum: [
                      "text/markdown",
                      "application/vnd.ant.code",
                      "image/svg+xml",
                      "application/vnd.mermaid",
                      "text/html",
                      "application/vnd.react",
                      "application/vnd.bibliography"
                    ]
                  },
                  id: { type: "string" },
                  title: { type: "string" },
                  content: { type: "string" },
                  language: { type: "string" }
                }
              }
            }
          }
        }
      }
    }
  }],
  tool_choice: { type: "tool", name: "response_formatter" }
}
```

### Final Output Format (Response to Client)
```typescript
{
  response: {
    thinking?: string,
    conversation: string,    // Markdown formatted text with artifact buttons
    artifacts?: Array<{
      id: string,
      artifactId?: string,
      type: string,         // Content type (e.g., "code", "text/markdown")
      title: string,
      content: string,
      position: number,
      language?: string     // Programming language if applicable
    }>
  }
}
```

## Special Cases in Final Output

1. **Binary Outputs**: Images and other binary content are added as additional artifacts
2. **Bibliography Entries**: Added as a special artifact type
3. **Source Code for Binary Outputs**: If available, added as a separate artifact
4. **Artifact Buttons**: Embedded in the conversation text using HTML button elements

This structure ensures a consistent format for both tool interactions and the final response, while handling various types of content (text, code, images, etc.) in a unified way. 


# Ollama API (NOT JAVASCRIPT LIBRARY) Data Structures and calls examples

## Chat request (with tools)
```
curl http://localhost:11434/api/chat -d '{
  "model": "llama3.2",
  "messages": [
    {
      "role": "user",
      "content": "What is the weather today in Paris?"
    }
  ],
  "stream": false,
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_current_weather",
        "description": "Get the current weather for a location",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "The location to get the weather for, e.g. San Francisco, CA"
            },
            "format": {
              "type": "string",
              "description": "The format to return the weather in, e.g. 'celsius' or 'fahrenheit'",
              "enum": ["celsius", "fahrenheit"]
            }
          },
          "required": ["location", "format"]
        }
      }
    }
  ]
}'
```

### Response
```json
{
  "model": "llama3.2",
  "created_at": "2024-07-22T20:33:28.123648Z",
  "message": {
    "role": "assistant",
    "content": "",
    "tool_calls": [
      {
        "function": {
          "name": "get_current_weather",
          "arguments": {
            "format": "celsius",
            "location": "Paris, FR"
          }
        }
      }
    ]
  },
  "done_reason": "stop",
  "done": true,
  "total_duration": 885095291,
  "load_duration": 3753500,
  "prompt_eval_count": 122,
  "prompt_eval_duration": 328493000,
  "eval_count": 33,
  "eval_duration": 552222000
}


##Request (Structured outputs)
Request

curl -X POST http://localhost:11434/api/generate -H "Content-Type: application/json" -d '{
  "model": "llama3.1:8b",
  "prompt": "Ollama is 22 years old and is busy saving the world. Respond using JSON",
  "stream": false,
  "format": {
    "type": "object",
    "properties": {
      "age": {
        "type": "integer"
      },
      "available": {
        "type": "boolean"
      }
    },
    "required": [
      "age",
      "available"
    ]
  }
}'

Response
{
  "model": "llama3.1:8b",
  "created_at": "2024-12-06T00:48:09.983619Z",
  "response": "{\n  \"age\": 22,\n  \"available\": true\n}",
  "done": true,
  "done_reason": "stop",
  "context": [1, 2, 3],
  "total_duration": 1075509083,
  "load_duration": 567678166,
  "prompt_eval_count": 28,
  "prompt_eval_duration": 236000000,
  "eval_count": 16,
  "eval_duration": 269000000
}


Request (JSON mode)
Important

When format is set to json, the output will always be a well-formed JSON object. It's important to also instruct the model to respond in JSON.

Request
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "What color is the sky at different times of the day? Respond using JSON",
  "format": "json",
  "stream": false
}'
Response
{
  "model": "llama3.2",
  "created_at": "2023-11-09T21:07:55.186497Z",
  "response": "{\n\"morning\": {\n\"color\": \"blue\"\n},\n\"noon\": {\n\"color\": \"blue-gray\"\n},\n\"afternoon\": {\n\"color\": \"warm gray\"\n},\n\"evening\": {\n\"color\": \"orange\"\n}\n}\n",
  "done": true,
  "context": [1, 2, 3],
  "total_duration": 4648158584,
  "load_duration": 4071084,
  "prompt_eval_count": 36,
  "prompt_eval_duration": 439038000,
  "eval_count": 180,
  "eval_duration": 4196918000
}
The value of response will be a string containing JSON similar to:

{
  "morning": {
    "color": "blue"
  },
  "noon": {
    "color": "blue-gray"
  },
  "afternoon": {
    "color": "warm gray"
  },
  "evening": {
    "color": "orange"
  }
}
