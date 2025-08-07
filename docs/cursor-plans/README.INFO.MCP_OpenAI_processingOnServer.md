# OpenAI MCP Processing Flow on Server

This document outlines the step-by-step process of how MCP (Modular Command Protocol) responses are processed on the server when using OpenAI as the LLM provider. We'll use the PubMed MCP as a concrete example.

## Overview

The processing flow involves several stages:
1. Initial request handling
2. Tool execution
3. Sequential thinking
4. Response formatting
5. Artifact processing

## Detailed Flow

### 1. Initial Request Processing
- Request arrives at `/chat` endpoint
- Contains:
  ```typescript
  {
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    modelProvider: 'openai',
    blockedServers?: string[]
  }
  ```
- System checks available MCP servers and blocked servers

### 2. Tool Execution
When a tool (like PubMed search) is called:
```typescript
const toolResult = await mcpService.callTool(serverName, toolName, content.input);
```

#### Example PubMed MCP Response:
```typescript
{
  content: [{
    type: "text",
    text: `# Search Results for: ${formattedQuery}\n\n${markdownArticles.join("\n\n")}`,
    forModel: true  // This content goes to the LLM
  }],
  bibliography: bibliographyData,  // This becomes an artifact
  isError: false
}
```

### 3. Sequential Thinking Process
After receiving the MCP response, the system:

1. **Adds Tool Result to Conversation**
   - Tool result is added to message history
   - LLM can see both the original query and tool results

2. **Initiates Thinking Steps**
   ```
   Step 1: Initial tool execution (e.g., PubMed search)
   Step 2: Analysis of tool results
   ```

3. **Decision Points**
   - LLM can decide to:
     - Make additional tool calls if needed
     - Process current results
     - Complete the response

4. **Completion Check**
   - System checks for additional tool calls
   - If none found, marks sequential thinking as complete

### 4. Response Formatting
Once sequential thinking is complete:

1. **OpenAI Formatter Processing**
   ```typescript
   // In OpenAIResponseFormatterAdapter
   return {
     thinking: formatterOutput.thinking,
     conversation: processedConversation,
     artifacts: artifacts.length > 0 ? artifacts : undefined
   };
   ```

2. **Artifact Creation**
   ```typescript
   {
     id: "vnd.bibliography-[uuid]",
     artifactId: "vnd.bibliography-[uuid]",
     type: "application/vnd.bibliography",
     title: "Bibliography",
     content: JSON.stringify(bibliographyData),
     position: 0
   }
   ```

### 5. Final Response Structure
The final response includes both content and artifacts:
```json
{
  "type": "artifact",
  "artifact": {
    "id": "vnd.bibliography-[uuid]",
    "artifactId": "vnd.bibliography-[uuid]",
    "type": "application/vnd.bibliography",
    "title": "Bibliography",
    "content": "[{\"authors\":[...],\"year\":\"...\",\"title\":\"...\",\"journal\":\"...\",\"pmid\":\"...\"}]",
    "position": 0
  }
}
```

## Processing Timeline

Here's the typical sequence of events (from logs):

1. **Tool Execution**
   ```
   "Executing tool: pubmed-search..."
   ```

2. **Sequential Thinking**
   ```
   "Running thinking step 2..."
   ```

3. **Thinking Completion**
   ```
   "No tool calls found, sequential thinking complete."
   "Sequential thinking completed in 2 steps."
   ```

4. **Response Processing**
   ```
   "Getting formatted response from openai..."
   "Processing formatter output..."
   "Collecting artifacts from tool results..."
   ```

## Key Features

1. **Iterative Processing**
   - System allows multiple tool calls in sequence
   - LLM can chain different tools together
   - Each tool result can lead to additional processing

2. **Artifact Preservation**
   - Structured data (like bibliography) is preserved
   - Artifacts maintain their format throughout processing
   - Each artifact gets unique ID and position

3. **Flexible Decision Making**
   - LLM can decide when it has sufficient information
   - Can make additional tool calls if needed
   - Supports complex multi-step reasoning

## Common Use Cases

1. **Literature Search**
   - PubMed search returns bibliography
   - LLM analyzes papers
   - May request more specific searches

2. **Data Analysis**
   - Tool returns structured data
   - LLM processes and explains results
   - May request additional data points

3. **Multi-step Research**
   - Initial broad search
   - Follow-up specific queries
   - Final synthesis of information

This processing flow ensures that:
- Tool results are properly analyzed
- Multiple tools can be chained together
- Structured data is preserved
- Responses are well-formatted for the UI 