# Cursor Rule: Ollama Integration Implementation Notes

## Key Implementation Details

### 1. Response Format Quirks

When implementing Ollama tool calling integration, be aware of these format quirks:

- Ollama may return tool arguments as a string JSON inside an object instead of parsed JSON:
  ```json
  "arguments": {
    "terms": "[{\"operator\":\"AND\",\"term\":\"BRCA1\"}]"  // String JSON, not an array
  }
  ```

- Tool names may be namespaced (e.g., "calculator.add") and require parsing.

- The current adapter handles these quirks by:
  - Adding string JSON parsing when arguments are strings
  - Supporting namespaced tool names (splitting by '.')
  - Converting underscores back to hyphens for MCP compatibility (pubmed_search → pubmed-search)

**Implementation Details:**

```typescript
// Handle string JSON in arguments
if (typeof toolCall.function.arguments === 'string') {
  // Try to parse as JSON
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch {
    // If parsing fails, use as query parameter
    args = { query: toolCall.function.arguments.trim() };
  }
}

// Handle namespaced tool names
if (fullName.includes('.')) {
  const parts = fullName.split('.');
  toolName = parts[0];
  operation = parts.slice(1).join('.');
}

// Convert underscores back to hyphens
toolName = toolName.replace ? toolName.replace(/_/g, '-') : toolName;
```

### 2. Double Tool Conversion

The OllamaToolAdapter's `convertToolDefinitions` method may be called twice with different formats:
- First with raw MCP tools (having `name` and `input_schema`)
- Then with already converted tools (having `type: 'function'` and `function` property)

The adapter handles this by detecting the format and avoiding double conversion.

**Implementation Details:**

```typescript
// Check if the tool is already in Ollama format (has function property)
if (anyTool.type === 'function' && anyTool.function) {
  console.log(`🟤 [ADAPTER: OLLAMA] Tool already in Ollama format: ${anyTool.function.name}`);
  return anyTool;
}
```

### 3. Required Arguments Format

For pubmed-search, Ollama may return an incorrect argument format:
```json
{ "query": "BRCA1" }  // Missing required 'terms' array
```

The adapter transforms this to the required format:
```json
{ "terms": [{ "term": "BRCA1" }] }
```

**Implementation Details:**

```typescript
// Special case for pubmed-search - ensure it has the required format
if (toolName === 'pubmed-search' && (!args.terms || !Array.isArray(args.terms))) {
  const searchTerm = typeof args.query === 'string' ? args.query : 
                    (args.raw as string || 'cancer research');
  args = {
    terms: [{ term: searchTerm }]
  };
  console.log(`🟤 [ADAPTER: OLLAMA] Fixed pubmed-search args: ${JSON.stringify(args)}`);
}
```

## Testing

Use this curl command to test Ollama tool calling:

```bash
curl -s http://localhost:11434/api/chat -H "Content-Type: application/json" -d '{
  "model":"llama3.2:latest",
  "messages":[
    {"role":"user","content":"Please search for papers about BRCA1 using the pubmed_search tool."}
  ],
  "stream":false,
  "tools":[
    {
      "type":"function",
      "function":{
        "name":"pubmed_search",
        "description":"Search PubMed for articles",
        "parameters":{
          "type":"object",
          "properties":{
            "terms":{
              "type":"array",
              "items":{
                "type":"object",
                "properties":{
                  "term":{"type":"string"},
                  "operator":{"type":"string","enum":["AND","OR","NOT"]}
                },
                "required":["term"]
              }
            }
          }
        }
      }
    }
  ]
}' | jq '.'
```

## Troubleshooting

If you encounter issues with Ollama tool integration:

1. Check the logs for the adapter's output to see the different stages of tool handling.
2. Ensure the tool format matches what Ollama expects (type: 'function', function: {...}).
3. Verify the arguments being passed to the MCP tool have the required format.
4. Make sure Ollama is running locally at http://localhost:11434.

# Ollama Integration with MCP

This document outlines key challenges and solutions when integrating Ollama with MCP (Model Context Protocol).

## Key Issues and Solutions

### 1. Operator Validation in PubMed Search

**Problem**: Ollama's tool calling format allows empty strings or null as operators in PubMed search terms, but MCP strictly enforces valid enum values ('AND', 'OR', 'NOT').

**Error Examples**:
```
MCP error -32603: Invalid arguments: terms.0.operator: Invalid enum value. Expected 'AND' | 'OR' | 'NOT', received ''
MCP error -32603: Invalid arguments: terms.0.operator: Expected 'AND' | 'OR' | 'NOT', received null
```

**Solution**: The OllamaToolAdapter now normalizes all operators, even for the first term:
- Any term with empty, null, or missing operator gets a default value of 'AND'
- This ensures strict compliance with MCP's enum requirements

### 2. String vs Object Arguments

**Problem**: Ollama sometimes returns arguments as a string (JSON-encoded) rather than a parsed object.

**Solution**: The OllamaToolAdapter attempts to parse string arguments as JSON objects.

### 3. Namespaced Tool Names

**Problem**: Ollama uses namespaced tool names (e.g., "calculator.add") while MCP expects them to be split.

**Solution**: The adapter splits namespaced tool names into tool name and operation.

### 4. Double Tool Format Conversion

**Problem**: Tools might be pre-converted, leading to double conversion issues.

**Solution**: The adapter detects already converted tools and preserves their format.

### 5. PubMed-Search Format Handling

**Problem**: PubMed-search requires a specific structure with a terms array.

**Solution**: Special handling ensures the terms array is correctly formatted.

### 6. Response Formatting Adaptation

**Problem**: Ollama doesn't consistently use tool calling for response formatting and may return direct text content instead of using the expected tool call structure.

**Error Example**:
```
Error: Expected response_formatter tool call or content from OpenAI
```

**Solution**: Created a dedicated `OllamaResponseFormatterAdapter` that:
- Handles both tool call responses and direct text responses
- Attempts to extract JSON from text content when tool calls aren't present
- Creates fallback text-only responses when structured data isn't available
- Properly converts Ollama's free-form responses into standard store format

## OllamaToolAdapter Responsibilities

The OllamaToolAdapter handles:

1. Converting MCP tool definitions to Ollama format
2. Extracting tool calls from Ollama responses and normalizing them
3. Formatting tool results to send back to Ollama

## OllamaResponseFormatterAdapter Responsibilities

The OllamaResponseFormatterAdapter handles:

1. Providing an Ollama-specific tool definition for the response formatter
2. Extracting formatter output from Ollama's unconventional responses
3. Converting extracted output to the standardized store format
4. Robust fallback mechanisms for when Ollama doesn't follow the expected format

For more details, see:
- `src/server/services/chat/adapters/ollama.ts` - Tool handling
- `src/server/services/chat/formatters/ollama.ts` - Response formatting

## Testing Ollama Tool Integration

You can test Ollama's tool calling capabilities locally with:

```bash
curl -X POST http://localhost:11434/api/chat -d '{
  "model": "llama3.2",
  "messages": [
    {"role": "user", "content": "Search for papers about cancer"}
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "pubmed_search",
        "description": "Search PubMed for articles",
        "parameters": {
          "type": "object",
          "properties": {
            "terms": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "term": {"type": "string"},
                  "operator": {"type": "string", "enum": ["AND", "OR", "NOT"]}
                }
              }
            }
          },
          "required": ["terms"]
        }
      }
    }
  ]
}'
``` 