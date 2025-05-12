# Sequential Thinking and Tool Calling Process
Created: 2024-05-10

## Overview
This document details how the sequential thinking process works in the chat service, particularly focusing on how tool results are processed and how they influence subsequent steps.

## Process Flow

### 1. Initial Tool Call
```typescript
// Tool is called and returns result
const toolResult = await this.mcpService.callTool(
  serverName,
  toolName,
  toolCall.input
);
```

### 2. Processing Tool Result
The tool result is processed in two steps:
1. Tool usage is recorded:
```typescript
workingMessages.push({
  role: 'assistant',
  content: `Used tool: ${toolCall.name}\nArguments: ${JSON.stringify(toolCall.input)}`
});
```

2. Tool's content is added:
```typescript
workingMessages.push({
  role: 'user',
  content: textContent  // The text content from the tool
});
```

### 3. Next Sequential Thinking Step
The system prompt is rebuilt with new content:
```typescript
const systemPrompt = this.buildSystemPromptWithContext(formattedHistory, providerTools);

// LLM is queried again
const response = await this.llmService.query({
  prompt: latestMessage,
  options: {
    temperature: options.temperature || 0.2,
    maxTokens: options.maxTokens || 4000,
    tools: providerTools,
    toolChoice: toolChoiceValue
  },
  systemPrompt: systemPrompt
});
```

### 4. Final Formatting
After sequential thinking completes:
```typescript
// Get formatter adapter and tool definition
const formatterAdapter = getResponseFormatterAdapter(options.modelProvider);
const formatterToolDefinition = formatterAdapter.getResponseFormatterToolDefinition();

// Build final system prompt with only formatter tool
const formatterSystemPrompt = this.buildSystemPromptWithContext(
  formattedHistory, 
  [formatterToolDefinition], 
  toolChoice
);

// Make final LLM call
const llmResponse = await this.llmService.query({
  prompt: latestMessage,
  options: {
    temperature: options.temperature || 0.2,
    maxTokens: options.maxTokens || 4000,
    toolChoice: toolChoice as any,
    tools: [formatterToolDefinition]
  },
  systemPrompt: formatterSystemPrompt
});
```

## Key Points

### Content Flow
1. Tool result → workingMessages array
2. workingMessages → formattedHistory
3. formattedHistory → system prompt
4. system prompt → next LLM call

### System Prompt Changes
- During sequential thinking: Contains all tools and full history
- During final formatting: Contains only formatter tool and processed history

### History Processing
- Each tool result becomes part of the conversation history
- History is formatted according to the provider type
- History is included in the system prompt

### Tool Selection
- During sequential thinking: Model can choose any available tool
- During final formatting: Model must use the formatter tool

### Tool Priority System
- Tools can be assigned priority levels to influence the model's tool selection
- Higher priority tools are more likely to be chosen when multiple tools could fulfill a task
- Priority is implemented through tool metadata and influences the model's decision-making process
- The system maintains a balance between priority and task relevance

## Important Notes
- Tool results influence subsequent tool choices through the conversation history
- The system prompt is rebuilt at each step to include new information
- The final formatting step uses a restricted set of tools to ensure proper response formatting 