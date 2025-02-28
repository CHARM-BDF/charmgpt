# Local LLM Tool Calling Guide

## Overview
This guide documents the tested configurations for function/tool calling with local LLMs using Ollama. Based on testing performed on February 25, 2025.

## Quick Reference

### Compatible Models
| Model | Size | Tool Support | Quality |
|-------|------|--------------|----------|
| mistral:latest | 7.2B | ✅ | Best - Complete parameter handling |
| qwen2:latest | 7.6B | ✅ | Good - Basic parameter handling |
| llama3.2:latest | 3.2B | ✅ | Good - Basic parameter handling |
| llama2:latest | 7B | ❌ | No tool support |
| deepseek-r1:70b | 70.6B | ❌ | No tool support |
| deepseek-r1:32b | 32.8B | ❌ | No tool support |
| deepscaler:latest | 1.8B | ❌ | No tool support |

### Streaming Support
| Model | Size | Streaming Performance | Notes |
|-------|------|----------------------|-------|
| deepseek-r1:1.5b | 1.5B | ✅ Good | Slow to start, then streams quickly |
| deepseek-r1:7b | 7B | ✅ Fair | Works but streams slowly |
| deepseek-r1:70b | 70B | ✅ Poor | Works but very slow streaming |
| llama3.2:latest | 3.2B | ❌ Unreliable | Inconsistent streaming results |

## Working Examples

### 1. Direct API Call Format
```bash
curl -X POST http://localhost:11434/api/chat -d '{
  "model": "mistral:latest",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant with access to tools."
    },
    {
      "role": "user",
      "content": "Search for a paper about BRCA1"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "pubmed_search",
        "description": "Search for papers in PubMed",
        "parameters": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "The search query"
            },
            "limit": {
              "type": "integer",
              "description": "Maximum number of results"
            }
          },
          "required": ["query"]
        }
      }
    }
  ]
}'
```

### 2. Application Integration Examples
Successful tool calls through application endpoint (localhost:3001/api/ollama):

```bash
# Example 1: Explicit Tool Mention
curl -X POST http://localhost:3001/api/ollama -H "Content-Type: application/json" -d '{
  "message": "Use pubmed:search to find one paper about BRCA1 gene",
  "history": [],
  "blockedServers": []
}'

# Example 2: Natural Language Query
curl -X POST http://localhost:3001/api/ollama -H "Content-Type: application/json" -d '{
  "message": "Find me a recent research paper about the BRCA1 gene and summarize its findings",
  "history": [],
  "blockedServers": []
}'
```

## Implementation Best Practices

### 1. System Message
Keep it simple and direct:
```json
{
  "role": "system",
  "content": "You are a helpful AI assistant with access to tools. When asked about papers or research, always use the appropriate tool to get real information. Never make up or hallucinate information."
}
```

### 2. Critical Configuration
```typescript
// Ollama chat options
const options = {
  temperature: 0.7,
  num_predict: 1024,
  top_k: 40,
  top_p: 0.9,
  repeat_penalty: 1.1
};

// Important: Do NOT include XML-style stop tokens
// Avoid including:
// stop: ['</tool_calls>', '</function_calls>']
```

### 3. Tool Definition Format
```typescript
const tool = {
  type: 'function',
  function: {
    name: 'tool_name',
    description: 'Clear description',
    parameters: {
      type: 'object',
      properties: {
        // Define parameters here
      },
      required: ['required_param_names']
    }
  }
};
```

## Common Pitfalls and Solutions

### 1. XML-Style Instructions
❌ Problem: Including XML-style tool call examples in system message
✅ Solution: Remove XML formatting instructions, let model use native JSON format

### 2. Stop Tokens
❌ Problem: Using stop tokens that expect XML format
✅ Solution: Remove stop tokens or use only JSON-compatible stops if needed

### 3. Complex System Messages
❌ Problem: Long, detailed system messages with multiple formats
✅ Solution: Keep system message simple and focused on tool usage

## Testing Strategy

### 1. Verify Tool Integration
Test with explicit tool mentions first:
```bash
curl -X POST http://localhost:3001/api/ollama -d '{"message": "Use pubmed:search to find one paper about BRCA1 gene"}'
```

### 2. Test Natural Language
Progress to natural language queries:
```bash
curl -X POST http://localhost:3001/api/ollama -d '{"message": "Find me a recent research paper about the BRCA1 gene"}'
```

### 3. Monitor Responses
- Check if tool_calls are present in response
- Verify parameter handling
- Ensure proper tool execution

## Performance Optimization

### 1. Model Selection
- Use mistral:latest for best tool handling
- Consider llama3.2:latest for faster, lighter operations
- qwen2:latest as alternative for basic tool usage

### 2. Response Processing
- Handle tool responses efficiently
- Process multiple tool calls iteratively
- Maintain conversation context

## Streaming Implementation

### 1. Model Selection for Streaming
- **deepseek-r1:1.5b**: Best balance of speed and quality for streaming responses
- **deepseek-r1:7b**: Better quality but slower streaming performance
- **deepseek-r1:70b**: Highest quality but significantly slower streaming

### 2. Streaming Configuration
```typescript
// Streaming configuration for deepseek models
const streamingResponse = await ollama.chat({
  model: 'deepseek-r1:1.5b', // Best performer for streaming
  messages: streamingMessages,
  stream: true,  // Enable streaming
  options: {
    temperature: 0.7,
    num_predict: 1024,
    top_k: 40,
    top_p: 0.9,
    repeat_penalty: 1.1
  }
});

// Process streaming response
for await (const chunk of streamingResponse) {
  if (chunk.message && chunk.message.content) {
    // Process each chunk as it arrives
    streamedResponse.message.content += chunk.message.content;
  }
}
```

### 3. Streaming Best Practices
- Remove `tool_calls` from messages before streaming to prevent JSON unmarshalling errors
- Use a simplified system prompt for streaming calls
- Implement fallback to non-streaming if streaming fails
- Log each chunk with timestamps to monitor performance
- Track total chunks and processing time for optimization

### 4. Streaming Workflow
1. Use tool-capable models (mistral:latest) for initial tool selection
2. Process tool calls and collect results
3. Use deepseek models for final streaming response formatting
4. Implement proper error handling for both streaming and non-streaming paths

### 5. Testing Streaming with curl
```bash
# Direct streaming test with Ollama API
curl -X POST http://localhost:11434/api/chat -d '{
  "model": "deepseek-r1:1.5b",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "Explain how to analyze gene expression data"
    }
  ],
  "stream": true,
  "options": {
    "temperature": 0.7,
    "num_predict": 1024
  }
}'

# Testing through application endpoint
# Note: This may show "Empty reply from server" in curl but logs will show streaming is working
curl -X POST http://localhost:3001/api/ollama -H "Content-Type: application/json" -d '{
  "message": "Explain how to analyze DYRK1A gene expression data using Python, with code examples",
  "blockedServers": ["pubmed", "ncbi"]
}'
```

### 6. Monitoring Streaming Performance
To verify streaming is working properly, check server logs:
```bash
# Look for log entries with "OLLAMA CHUNK" which indicate streaming chunks
grep "OLLAMA CHUNK" ./logs/server-*.log | tail -20

# Count total chunks and time to complete
grep "OLLAMA CHUNK" ./logs/server-*.log | wc -l
grep "Formatting streaming complete" ./logs/server-*.log
```

## Future Considerations
1. Monitor model updates for improved tool support
2. Test new models as they become available
3. Keep documentation updated with latest findings
4. Track performance metrics across different models

## References
- Ollama API Documentation: http://localhost:11434/api
- Model Versions Tested: February 25, 2025
- Testing Environment: MacOS darwin 24.3.0
- Implementation Status: Successfully tested and working 