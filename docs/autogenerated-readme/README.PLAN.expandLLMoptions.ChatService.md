# ChatService Implementation Plan

## Context
- **Purpose**: Details the implementation of a unified ChatService that works with multiple LLM providers
- **Related Documents**: 
  - [README.PLAN.expandLLMoptions.md](./README.PLAN.expandLLMoptions.md) - Overall multi-provider strategy
  - [README.PLAN.responseFormatters.md](./README.PLAN.responseFormatters.md) - Response formatter implementation
- **Dependencies**: Requires implementation of response formatter adapters (completed)

## Overview

This document details the implementation of a unified ChatService that works consistently with all supported LLM providers (Anthropic/Claude, OpenAI, and Gemini). The implementation uses the response formatter adapters to ensure structured output regardless of the provider used.

The focus is on delivering properly structured responses for the UI, rather than streaming incremental content.

## Implementation Status

### Completed
- ✅ Created ChatService class with provider-agnostic processing
- ✅ Implemented sequential thinking with tools support for all providers
- ✅ Added response formatter adapter integration
- ✅ Created chat-artifacts route using the new ChatService
- ✅ Implemented ChatService factory pattern
- ✅ Updated server initialization to use the factory

### Remaining
- Improve type safety around message formatting
- Add proper unit tests
- Update additional routes to use the new ChatService
- Implement streaming support
- Add robust error handling

## Implementation Approach

### 1. ChatService Interface

Create a provider-agnostic `ChatService` class that serves as the central component for all LLM interactions:

```typescript
export class ChatService {
  private llmService: LLMService;
  private messageService: MessageService;
  private mcpService: MCPService;
  
  constructor(deps: {
    llmService: LLMService;
    messageService: MessageService;
    mcpService: MCPService;
  }) {
    this.llmService = deps.llmService;
    this.messageService = deps.messageService;
    this.mcpService = deps.mcpService;
  }
  
  // Core chat processing methods
  async processChat(message, history, options): Promise<StoreFormat>;
  async runSequentialThinking(message, history, tools, options): Promise<ChatMessage[]>;
  
  // Provider management
  setProvider(provider: ModelType): void;
  getProvider(): ModelType;
}
```

### 2. Core Implementation Details

#### Provider-Agnostic Chat Processing

The main `processChat` method handles all providers:

```typescript
async processChat(
  message: string,
  history: ChatMessage[],
  options: {
    modelProvider: ModelType;
    blockedServers?: string[];
    pinnedGraph?: any;
    temperature?: number;
    maxTokens?: number;
  },
  statusHandler?: (status: string) => void
): Promise<StoreFormat> {
  // 1. Set the provider based on options.modelProvider
  this.llmService.setProvider({
    provider: options.modelProvider as any,
    temperature: options.temperature || 0.2,
    maxTokens: options.maxTokens || 4000
  });
  
  // 2. Get available MCP tools
  let mcpTools: AnthropicTool[] = [];
  if (this.mcpService) {
    statusHandler?.('Retrieving available tools...');
    mcpTools = await this.mcpService.getAllAvailableTools(options.blockedServers);
  }
  
  // 3. Run sequential thinking with tools if needed
  const processedHistory = await this.runSequentialThinking(
    message,
    history,
    mcpTools,
    options.modelProvider,
    {
      temperature: options.temperature,
      maxTokens: options.maxTokens
    },
    statusHandler
  );
  
  // 4. Get the appropriate response formatter adapter
  const formatterAdapter = getResponseFormatterAdapter(options.modelProvider as FormatterAdapterType);
  const formatterToolDefinition = formatterAdapter.getResponseFormatterToolDefinition();
  
  // 5. Format messages and create system prompt with context
  const latestMessage = processedHistory[processedHistory.length - 1].content as string;
  const formattedHistory = this.formatMessageHistory(
    processedHistory.slice(0, -1),
    options.modelProvider
  );
  
  // 6. Get the formatted response from the LLM
  const llmResponse = await this.llmService.query({
    prompt: latestMessage,
    options: {
      temperature: options.temperature || 0.2,
      maxTokens: options.maxTokens || 4000
    },
    systemPrompt: this.buildSystemPromptWithContext(formattedHistory, 
      [formatterToolDefinition], 
      { type: 'tool', name: 'response_formatter' })
  });
  
  // 7. Extract and convert the formatter output
  const formatterOutput = formatterAdapter.extractFormatterOutput(llmResponse.rawResponse);
  let storeFormat = formatterAdapter.convertToStoreFormat(formatterOutput);
  
  // 8. Enhance with additional artifacts if needed
  if (options.pinnedGraph) {
    storeFormat = this.messageService.enhanceResponseWithArtifacts(
      storeFormat,
      [options.pinnedGraph]
    );
  }
  
  return storeFormat;
}
```

#### Sequential Thinking Implementation

The `runSequentialThinking` method works with all providers:

```typescript
async runSequentialThinking(
  message: string,
  history: ChatMessage[],
  mcpTools: AnthropicTool[],
  modelProvider: ModelType,
  options: {
    temperature?: number;
    maxTokens?: number;
  } = {},
  statusHandler?: (status: string) => void
): Promise<ChatMessage[]> {
  // Initialize working messages with history and the new message
  const workingMessages = [
    ...this.formatMessageHistory(history, modelProvider),
    { role: 'user', content: message }
  ];
  
  // Get the tool adapter for this provider
  const toolAdapter = getToolCallAdapter(modelProvider);
  
  // Convert MCP tools to provider-specific format
  const providerTools = toolAdapter.convertToolDefinitions(mcpTools);
  
  // Run the sequential thinking process
  let isSequentialThinkingComplete = false;
  let thinkingSteps = 0;
  const MAX_THINKING_STEPS = 5;
  
  while (!isSequentialThinkingComplete && thinkingSteps < MAX_THINKING_STEPS) {
    thinkingSteps++;
    statusHandler?.(`Running thinking step ${thinkingSteps}...`);
    
    // Get the latest message to send to the LLM
    const latestMessage = workingMessages[workingMessages.length - 1].content as string;
    
    // Format history for the provider, excluding the latest message
    const formattedHistory = this.formatMessageHistory(
      workingMessages.slice(0, -1),
      modelProvider
    );
    
    // Get response from the LLM with tools
    const response = await this.llmService.query({
      prompt: latestMessage,
      options: {
        temperature: options.temperature || 0.2,
        maxTokens: options.maxTokens || 4000
      },
      systemPrompt: this.buildSystemPromptWithContext(formattedHistory, providerTools)
    });
    
    // Extract tool calls using the adapter
    const toolCalls = toolAdapter.extractToolCalls(response.rawResponse);
    
    if (toolCalls.length === 0) {
      // No tool calls, so we're done with sequential thinking
      isSequentialThinkingComplete = true;
      statusHandler?.('No tool calls found, sequential thinking complete.');
      continue;
    }
    
    // Execute each tool and update conversation
    for (const toolCall of toolCalls) {
      // ... Tool execution logic...
      
      // Check if this was sequential thinking tool
      if (toolCall.name.includes('sequential-thinking')) {
        try {
          const result = JSON.parse(typeof textContent === 'string' ? 
            textContent : JSON.stringify(textContent));
          isSequentialThinkingComplete = !result.nextThoughtNeeded;
        } catch (error) {
          isSequentialThinkingComplete = true;
        }
      }
    }
  }
  
  // Add the original user message for the final response
  if (isSequentialThinkingComplete) {
    workingMessages.push({
      role: 'user',
      content: message
    });
  }
  
  return workingMessages;
}
```

#### Provider-Specific Message Formatting

A key part of the implementation is correctly formatting messages for each provider:

```typescript
private formatMessageHistory(
  history: ChatMessage[],
  providerType: ModelType
): ProviderChatMessage[] {
  switch (providerType) {
    case 'openai':
      // OpenAI separates system messages from user/assistant
      return history.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
    case 'anthropic':
      // Anthropic has different content structure
      return history.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
    case 'gemini':
      // Gemini uses a different structure with parts
      return history.map(msg => ({
        role: msg.role === 'system' ? 'user' : msg.role, // Gemini doesn't have system role
        content: msg.content
      }));
      
    case 'ollama':
      // Ollama is similar to OpenAI
      return history.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
    default:
      // Default formatting
      return history.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
  }
}
```

#### System Prompt Context Building

Since the LLMService doesn't directly support message histories and tools in a standardized way across providers, we implemented a helper method to build a system prompt that includes this context:

```typescript
private buildSystemPromptWithContext(
  history: ProviderChatMessage[],
  tools: any[] = [],
  toolChoice?: { type: string; name: string }
): string {
  // Create a system prompt that includes the history and tools
  let systemPrompt = `
  You are very smart LLM that wants to help a user complete their task. 
  You will often see informaiton on how to use one or more tools and how to interact with them. 
  Your goal is to help the user answer their questions. You should use the tools that could help. However, there may not be a tool for the job. 
  
  Follow these basic guidlines:
  1. **Direct mention of a tool:** If a specific tool is mentioned use that one. If other tools could provide relevent information then mention them in your final reply but don't use them. 
  2. **Tool Selection:** Analyze the user's request and decide which tool (or sequence of tools) will best accomplish each part of the task. Use the most relevant tool for each subtask. If multiple steps are required, plan the steps in a logical order.
  3. **Avoid Redundancy:** Do not repeat a tool action on the same or equivalent input. Remember the results of tools you've already used. *(For example, if you have already used `search_papers` to find results for "machine learning biomarkers", do not search again for the same query; use the results you have.)* Tools are idempotent: calling them with identical inputs will not yield new information.
  

  \n\n
  `;
  
  // Add message history
  if (history.length > 0) {
    systemPrompt += '# Conversation History\n\n';
    history.forEach(msg => {
      systemPrompt += `${msg.role.toUpperCase()}: ${
        typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      }\n\n`;
    });
  }
  
  // Add tools if provided
  if (tools.length > 0) {
    systemPrompt += '# Available Tools\n\n';
    tools.forEach(tool => {
      systemPrompt += `Tool: ${tool.name}\n`;
      systemPrompt += `Description: ${tool.description || 'No description provided'}\n\n`;
    });
    
    // Add tool choice if specified
    if (toolChoice) {
      systemPrompt += `# Required Action\n\nYou MUST use the ${toolChoice.name} tool to format your response.\n`;
    }
  }
  
  return systemPrompt;
}
```

### 3. Chat Route Implementation

We updated the `chat-artifacts.ts` route to use the new ChatService:

```typescript
router.post('/', async (req: Request<{}, {}, { 
  message: string; 
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string | any[] }>;
  modelProvider?: 'anthropic' | 'ollama' | 'openai' | 'gemini';
  blockedServers?: string[];
  pinnedGraph?: any;
  temperature?: number;
  maxTokens?: number;
}>, res: Response) => {
  try {
    // Get the chat service from app locals
    const chatService = req.app.locals.chatService as ChatService;
    
    if (!chatService) {
      throw new Error('ChatService not initialized. Check server configuration.');
    }
    
    // Extract request params
    const { 
      message, 
      history, 
      modelProvider = 'anthropic',
      blockedServers = [],
      pinnedGraph,
      temperature = 0.2,
      maxTokens = 4000
    } = req.body;
    
    // Process the chat with the ChatService
    const response = await chatService.processChat(
      message,
      history,
      {
        modelProvider,
        blockedServers,
        pinnedGraph,
        temperature,
        maxTokens
      },
      // Pass the status handler to get updates
      sendStatusUpdate
    );
    
    // Stream each part of the response
    if (response.thinking) {
      res.write(JSON.stringify({
        type: 'thinking',
        content: response.thinking,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      }) + '\n');
    }
    
    // Handle conversation items (text and artifacts)
    if (response.conversation && Array.isArray(response.conversation)) {
      for (const item of response.conversation) {
        if (typeof item === 'object' && item !== null) {
          if (item.type === 'text' && item.content) {
            res.write(JSON.stringify({
              type: 'content',
              content: item.content,
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString()
            }) + '\n');
          } else if (item.type === 'artifact' && item.artifact) {
            res.write(JSON.stringify({
              type: 'artifact',
              artifact: item.artifact,
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString()
            }) + '\n');
          }
        }
      }
    }
  } catch (error) {
    // Error handling...
  }
});
```

## Integration Plan

### 1. ChatService Factory

Created a factory function to initialize the ChatService with all required dependencies:

```typescript
// In src/server/services/chatServiceFactory.ts
export function createChatService(app: Express.Application): ChatService {
  // Get or create services from app locals
  const llmService = app.locals.llmService || new LLMService();
  const mcpService = app.locals.mcpService;
  const messageService = new MessageService();
  const artifactService = new ArtifactService();
  
  if (!mcpService) {
    console.warn('Warning: MCPService not available, tool execution will not be possible');
  }
  
  // Create the ChatService with all dependencies
  const chatService = new ChatService(
    llmService,
    mcpService,
    messageService,
    artifactService
  );
  
  console.log('ChatService: Created and configured through factory');
  return chatService;
}
```

### 2. Server Integration

Updated the server initialization to create and register the ChatService:

```typescript
// In src/server/index.ts
import { createChatService } from './services/chatServiceFactory';

// Initialize the LLM service
app.locals.llmService = llmService;

// Create and register the chat service using the factory function
app.locals.chatService = createChatService(app);
console.log('Chat Service initialized and registered via factory');
```

## Implementation Checklist

- [x] Created ChatService class with core methods
- [x] Implemented provider-agnostic sequential thinking
- [x] Added LLM response formatting using response formatter adapters
- [x] Created factory function for ChatService initialization
- [x] Updated the chat-artifacts route to use the ChatService
- [ ] Add unit and integration tests
- [ ] Test with all providers
- [ ] Update additional routes to use the ChatService

## Challenges and Solutions

### 1. Provider-Specific Message Formatting

**Challenge**: Each provider has a different message format (e.g., OpenAI has separate system and user messages, Gemini uses a contents array).

**Solution**: Implemented a `formatMessageHistory` method that adapts the message history to the provider's expected format, with special handling for Gemini which doesn't support system messages directly.

### 2. Tool Calling Differences

**Challenge**: Providers differ in how they define and call tools.

**Solution**: Used existing tool adapters to handle these differences while maintaining a consistent interface. The adapter pattern allows each provider's unique tooling format to be hidden behind a common API.

### 3. LLMService Interface Limitations

**Challenge**: The LLMService interface doesn't directly support history and tools in the query method.

**Solution**: Created a `buildSystemPromptWithContext` helper that builds a system prompt containing conversation history and tool definitions, working around the interface limitations while maintaining compatibility.

### 4. Type Safety Issues

**Challenge**: Strict TypeScript type checking revealed incompatibilities between provider-specific message formats and our internal message types.

**Solution**: Created a separate `ProviderChatMessage` interface that allows for less restrictive role values than our internal `ChatMessage` type. This maintains type safety while allowing for provider-specific roles.

## Next Steps

### 1. Fix Remaining Type Issues

There are still some type issues to resolve, particularly with the message formatting in sequential thinking:

```
Argument of type 'ProviderChatMessage[]' is not assignable to parameter of type 'ChatMessage[]'.
  Type 'ProviderChatMessage' is not assignable to type 'ChatMessage'.
```

This requires updating the types or adding appropriate type assertions to ensure type safety without breaking functionality.

### 2. Streaming Support

Currently, the chat-artifacts route streams the complete response after it's fully generated. Future improvements should:

- Implement true streaming for responses from all providers
- Create provider-specific streaming adapters
- Support incremental artifact generation and updates

### 3. Expand Route Coverage

- Update all chat routes (basic, tools, sequential) to use the new ChatService
- Ensure consistent behavior across all routes
- Add support for additional features like pinned artifacts

### 4. Testing

- Create unit tests for the ChatService methods
- Test with all supported providers to ensure consistent behavior
- Create integration tests that verify the full flow from request to response

### 5. Documentation

- Update user documentation with the new architecture details
- Create a guide for adding new providers
- Document provider-specific behaviors and limitations

## Conclusion

The implementation of the ChatService represents a significant step forward in supporting multiple LLM providers in a consistent way. By using response formatter adapters and provider-specific adapters for tools, we've created a unified interface that hides the complexity of different provider APIs while ensuring consistent output formats for the UI.

The factory pattern for creating the ChatService enables easier testing and configuration, while the clear separation of concerns between components improves maintainability. The remaining work focuses on fixing type issues, expanding test coverage, and enhancing the implementation with streaming support and additional features. 