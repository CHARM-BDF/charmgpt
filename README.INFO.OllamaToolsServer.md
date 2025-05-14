# Ollama Integration Guide

## Overview

This document outlines the integration of Ollama models with the MCP service, focusing on tool/function calling capabilities based on testing with various models.

## Supported Models

Based on our testing, the following Ollama models support tool calling:

- **llama3.2:latest** - Most consistent and reliable support
- **mistral:latest** - Inconsistent support, sometimes returns text instead of tool calls

The following models **do not** support tool calls:
- deepscaler:latest
- deepseek-coder:latest

## Tool Format

Ollama requires a specific format for tool definitions and provides a unique format for tool call responses:

### Request Format

```json
{
  "model": "llama3.2:latest",
  "messages": [
    {
      "role": "user",
      "content": "Your instruction here"
    }
  ],
  "stream": false,
  "tools": [
    {
      "name": "tool_name",
      "description": "Tool description",
      "parameters": {
        "type": "object",
        "properties": {
          "param1": {
            "type": "string",
            "description": "Parameter description"
          },
          "param2": {
            "type": "number",
            "description": "Parameter description"
          }
        },
        "required": ["param1", "param2"]
      }
    }
  ]
}
```

### Response Format

```json
{
  "model": "llama3.2:latest",
  "created_at": "2025-05-14T03:11:53.253218Z",
  "message": {
    "role": "assistant",
    "content": "",
    "tool_calls": [
      {
        "function": {
          "name": "calculator.add",
          "arguments": {
            "a": "5",
            "b": "7"
          }
        }
      }
    ]
  },
  "done_reason": "stop",
  "done": true,
  "total_duration": 4322561059,
  "load_duration": 24161140,
  "prompt_eval_count": 144,
  "prompt_eval_duration": 2395650335,
  "eval_count": 22,
  "eval_duration": 1901855011
}
```

## Key Differences from OpenAI/Claude

1. **Tool Naming**:
   - Ollama uses a namespaced format: `tool_name.operation` (e.g., "calculator.add")
   - This differs from OpenAI's direct tool name references

2. **Arguments Format**:
   - Ollama tends to use simple key-value pairs (e.g., `{"a": "5", "b": "7"}`)
   - May not follow the exact parameter schema provided in the request

3. **Format Support**:
   - Only supports `tools` format, not `functions` format
   - No support for `tool_choice` parameter (as in OpenAI)

4. **Response Structure**:
   - Tool calls are in `.message.tool_calls[].function` format
   - Response includes performance metrics and loading information

## Integration Requirements

To fully integrate Ollama with the MCP service, the following components need to be implemented:

### 1. LLM Provider Implementation

Create a dedicated provider in `/src/server/services/llm/providers/ollama.ts`:
- Connection to local Ollama API (http://localhost:11434)
- Model selection and validation
- Proper error handling for model availability

### 2. Tool Adapter

Complete the `OllamaToolAdapter` in `/src/server/services/chat/adapters/ollama.ts`:
- Convert MCP tool definitions to Ollama-compatible format
- Extract tool calls from Ollama responses
- Handle the namespaced tool name format
- Parse inconsistent argument structures

### 3. Response Formatting

Create formatter for Ollama responses:
- Handle streaming vs. non-streaming responses
- Process tool call results
- Extract content from various response formats
- Maintain consistent structure with other providers

### 4. Error Handling

Implement robust error handling for Ollama-specific issues:
- Model availability checks
- Connection errors
- Tool format validation errors
- Inconsistent response handling

## Implementation Strategy

1. **Model Support**:
   - Default to llama3.2:latest for tool calling
   - Add model capability detection
   - Provide fallbacks for models without tool support

2. **Tool Conversion**:
   - Map MCP tools to Ollama tools format
   - Validate parameter schemas
   - Handle required fields appropriately

3. **Response Processing**:
   - Parse namespaced tool names
   - Extract and standardize arguments
   - Handle empty content with tool calls
   - Process streaming responses

4. **Testing Approach**:
   - Validate against multiple models
   - Test complex tool schemas
   - Ensure argument extraction works reliably
   - Verify streaming response handling

## Code Example: Tool Format Conversion

```typescript
// Simplified example of converting MCP tools to Ollama format
function convertToolsToOllamaFormat(tools: MCPTool[]): OllamaTool[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: "object",
      properties: tool.parameters.properties,
      required: tool.parameters.required || []
    }
  }));
}
```

## Code Example: Processing Tool Calls

```typescript
// Simplified example of processing Ollama tool calls
function extractToolCalls(response: OllamaResponse): ToolCall[] {
  if (!response.message?.tool_calls?.length) {
    return [];
  }

  return response.message.tool_calls.map(toolCall => {
    // Extract tool name and operation from namespaced format
    const [toolName, operation] = (toolCall.function.name || '').split('.');
    
    // Process arguments based on expected schema
    const args = toolCall.function.arguments || {};
    
    return {
      id: generateId(), // Generate an ID for tracking
      name: toolName,
      operation: operation,
      arguments: args,
      raw: toolCall // Preserve original format
    };
  });
}
```

## Limitations and Considerations

1. **Model Consistency**:
   - Tool call support varies greatly between models
   - Format and capabilities may change with model updates
   - Some models return text instead of structured tool calls

2. **Parameter Handling**:
   - Models may not follow parameter schemas exactly
   - Arguments may be returned as strings even for numeric values
   - Models might ignore required parameters or add unexpected ones

3. **Error Cases**:
   - Some models return explicit errors for tool support
   - Others silently fall back to text responses
   - Connection failures require robust retry mechanisms

4. **Performance**:
   - Local model performance depends on hardware
   - Complex tools may cause slower responses
   - Tool format conversion adds overhead

## Testing

A test script is available at `src/server/services/chat/adapters/test-ollama-tool-format.sh` to validate tool support across different Ollama models.

To run the test:
```bash
cd /path/to/project
chmod +x src/server/services/chat/adapters/test-ollama-tool-format.sh
./src/server/services/chat/adapters/test-ollama-tool-format.sh
```

The script provides detailed output on:
- Available models
- Tool format compatibility
- Response structures
- Argument formats
- Success/failure patterns

## Recommendations

1. **Preferred Model**: Use llama3.2:latest for most reliable tool support
2. **Request Format**: Use the tools format, not functions format
3. **Tool Names**: Keep tool names simple, without special characters
4. **Parameters**: Use simple parameter structures when possible
5. **Response Handling**: Account for both tool_calls and text responses
6. **Error Handling**: Implement robust fallbacks for models without tool support

## Future Improvements

1. **Model-Specific Optimizations**:
   - Tailor prompts to specific models
   - Adjust tool formats based on model capabilities
   - Implement model-specific error handling

2. **Enhanced Tool Processing**:
   - Better argument validation
   - More robust namespaced tool name handling
   - Support for complex nested parameters

3. **Performance Enhancements**:
   - Optimize connection management
   - Implement caching for model capabilities
   - Reduce overhead in tool format conversion 