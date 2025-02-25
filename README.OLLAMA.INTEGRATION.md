# Ollama Integration with MCP

## Overview

This document describes how the Ollama integration works with the Model Context Protocol (MCP) in our system. The integration allows Ollama to use tools provided by MCP servers, enabling powerful agent-like capabilities.

## Key Components

1. **Tool Name Standardization**: Converts MCP tool names (with hyphens) to Ollama-compatible format (with underscores)
2. **Server/Tool Mapping**: Maps tool calls to appropriate MCP servers and tools
3. **Response Processing**: Handles tool responses and formats them for the client
4. **Timeout Handling**: Implements graceful fallbacks for both initial and follow-up calls
5. **Error Handling**: Provides meaningful error messages and fallback responses

## Implementation Details

### Tool Conversion

The system converts MCP tools to Ollama format using the `convertToolsToOllamaFormat` function:

```typescript
const convertToolsToOllamaFormat = (mcpToolsResponse: MCPToolResponse): Tool[] => {
  return mcpToolsResponse.tools.map(tool => {
    // Standardize tool name: replace hyphens with underscores for consistency
    const standardizedName = tool.name.replace(/-/g, '_');
    
    // Build the parameters object
    const parameters = {
      type: tool.input_schema.type,
      required: tool.input_schema.required || [],
      properties: tool.input_schema.properties
    };

    return {
      type: 'function',
      function: {
        name: standardizedName,
        description: tool.description || "",
        parameters,
      },
    };
  });
};
```

### Tool Execution Flow

1. **Initial Request Processing**:
   - The system collects available tools from MCP servers
   - Tools are converted to Ollama format
   - A system prompt is added to guide Ollama's behavior

2. **Initial Call to Ollama**:
   ```typescript
   initialResponse = await Promise.race([
     ollama.chat({
       model: 'mistral:latest',
       messages: messages,
       tools: tools,
       stream: false,
       options: {
         temperature: 0.7,
         num_predict: 1024,
         top_k: 40,
         top_p: 0.9,
         repeat_penalty: 1.1
       }
     }),
     timeoutPromise // 60-second timeout
   ]);
   ```

3. **Tool Call Processing**:
   - The system extracts tool calls from Ollama's response
   - For each tool call, it determines the server and tool name:
     ```typescript
     // Direct mapping for known tools
     if (toolCall.function.name === 'pubmed_search') {
       serverName = 'pubmed';
       toolName = 'search';
     } else {
       // Format is just "tool" - need to determine server from tool name
       const toolNameWithoutUnderscores = toolCall.function.name.replace(/_/g, '-');
       
       // Find the server that has this tool
       // [Logic to extract server and tool names]
     }
     ```

4. **Tool Execution**:
   - The system calls the tool via MCPService
   - Responses are truncated if too long (>4000 chars)
   - Results are added to the message history

5. **Follow-up Call**:
   - The system sends the updated message history back to Ollama
   - Ollama generates a final response incorporating the tool results
   - A 60-second timeout is enforced

6. **Response Handling**:
   - If successful, the final response is returned to the client
   - If a timeout occurs, a fallback response is provided
   - The response includes both the text content and any tool calls

## Configuration

The system uses the following configuration:

- **Model**: `mistral:latest`
- **Temperature**: 0.7
- **Max Tokens**: 1024 (via `num_predict`)
- **Top K**: 40
- **Top P**: 0.9
- **Repeat Penalty**: 1.1
- **Initial Call Timeout**: 60 seconds
- **Follow-up Call Timeout**: 60 seconds

## System Prompt

The system uses the following prompt to guide Ollama's behavior:

```
You are a helpful AI assistant with access to tools. When asked about papers or research, 
USE the appropriate tool by making a tool_call, DO NOT suggest commands to the user. 
Always use tools to get real information rather than generating answers from your training. 
Never make up or hallucinate information.
```

## Error Handling

The system implements robust error handling:

1. **Server Health Check**:
   - Verifies Ollama server is available before processing requests
   - Returns clear error messages if the server is unavailable

2. **Timeout Protection**:
   - Uses `Promise.race()` with timeout promises
   - Provides fallback responses when timeouts occur

3. **Tool Execution Errors**:
   - Catches and logs errors during tool execution
   - Adds error messages to the conversation history

4. **Response Fallbacks**:
   - If follow-up calls fail, provides a meaningful summary response
   - Ensures the client always receives a useful response

## Logging

The system implements comprehensive logging:

- **Tool Conversion**: Logs tools before and after conversion
- **Request Details**: Logs messages and blocked servers
- **Response Analysis**: Logs detailed response structure
- **Tool Execution**: Logs tool names, arguments, and responses
- **Error Logging**: Logs detailed error information

## Example Flow

1. User asks: "Use pubmed_search to find one paper about DYRK1A gene"
2. System prepares tools including `pubmed_search` (mapped to `pubmed` server, `search` tool)
3. Ollama decides to use the `pubmed_search` tool with argument `{"terms": [{"term": "DYRK1A"}]}`
4. System executes the search on the PubMed MCP server
5. PubMed server returns results about DYRK1A gene
6. System sends results back to Ollama for final response
7. If follow-up times out, system provides a fallback summary of the results

## Response Format

The API returns a JSON object with:

```json
{
  "response": "The text response from Ollama",
  "tool_calls": [
    {
      "function": {
        "name": "tool_name",
        "arguments": { /* tool arguments */ }
      }
    }
  ]
}
```

## Troubleshooting

Common issues:

- **Tool Call Timeouts**: Usually occur with large responses that Ollama struggles to process
- **Tool Mapping Errors**: Check that tool names are properly mapped between MCP and Ollama formats
- **Response Truncation**: Large tool responses are truncated to 4000 characters to prevent overwhelming the model
- **Server Health**: Ensure Ollama server is running at the expected URL (http://localhost:11434)

## Conclusion

The Ollama integration with MCP provides a powerful way to extend Ollama's capabilities with external tools. The implementation successfully:

1. **Standardizes Tool Names**: Converts MCP's hyphenated tool names to Ollama's underscore format
2. **Maps Tool Calls**: Correctly identifies which MCP server and tool to call
3. **Handles Timeouts Gracefully**: Provides fallback responses when Ollama takes too long to process
4. **Formats Responses**: Returns both the text response and tool calls to the client
5. **Logs Extensively**: Provides detailed logs for debugging and monitoring

### Known Limitations

- **Follow-up Call Timeouts**: Large tool responses can cause Ollama to time out during follow-up calls
- **Fixed Fallback Message**: Currently uses a hardcoded fallback message for BRCA1 gene
- **Limited Tool Mapping**: Has special handling for `pubmed_search` but relies on naming conventions for other tools

### Future Improvements

- Implement dynamic fallback messages based on the actual tool response
- Add more direct mappings for commonly used tools
- Consider streaming responses to handle large tool outputs
- Explore ways to optimize follow-up calls to prevent timeouts
- Add more configuration options for timeout durations and model parameters 