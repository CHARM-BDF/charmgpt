# Multi-Provider LLM Model Architecture

This document provides a high-level architectural model of how LLM providers are selected and how the processing workflow functions in the refactored multi-provider implementation.

## Provider Selection Process

```
┌─────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│                 │      │                  │      │                  │
│  UI Selection   │─────▶│  API Request     │─────▶│  LLMService      │
│  (modelStore)   │      │  (modelProvider) │      │  (setProvider)   │
│                 │      │                  │      │                  │
└─────────────────┘      └──────────────────┘      └───────┬──────────┘
                                                           │
                                                           ▼
┌─────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│                 │      │                  │      │                  │
│ Provider Class  │◀─────│ Provider Factory │◀─────│ Provider Config  │
│ Implementation  │      │  (getProvider)   │      │ (model, options) │
│                 │      │                  │      │                  │
└─────────────────┘      └──────────────────┘      └──────────────────┘
```

### Selection Flow

1. **User Interface Selection**
   - User selects model provider in UI (Claude/Anthropic, OpenAI, Gemini)
   - Selection stored in modelStore
   - UI sends request with modelProvider parameter

2. **API Request Processing**
   - Server receives request with modelProvider parameter
   - Request routed to appropriate endpoint (chat, chat-artifacts)
   - modelProvider passed to ChatService

3. **LLMService Provider Setup**
   - ChatService calls LLMService.setProvider()
   - Validates model compatibility
   - Configures provider with defaults if needed

4. **Provider Implementation**
   - Provider factory creates/returns appropriate provider class
   - Each provider (AnthropicProvider, OpenAIProvider, GeminiProvider) has same interface but different implementation
   - Provider handles API-specific formatting and authentication

## Request Processing Workflow

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌─────────────────┐
│             │     │              │     │                │     │                 │
│ Chat Route  │────▶│ ChatService  │────▶│ Sequential     │────▶│ Tool Execution  │
│             │     │              │     │ Thinking       │     │                 │
└─────────────┘     └──────────────┘     └────────────────┘     └─────────────────┘
                           │                                             │
                           │                                             ▼
                           │                      ┌─────────────────────────────────────┐
                           │                      │                                     │
                           │                      │     Tool Execution Results          │
                           │                      │                                     │
                           │                      └───────────────────┬─────────────────┘
                           │                                          │
                           ▼                                          ▼
┌─────────────────┐     ┌──────────────┐     ┌────────────────┐     ┌─────────────────┐
│                 │     │              │     │                │     │                 │
│ Formatter       │◀────│ Final        │◀────│ Artifact       │◀────│ Specialized Data│
│ Response        │     │ Response     │     │ Collection     │     │ Extraction      │
│                 │     │              │     │                │     │                 │
└─────────────────┘     └──────────────┘     └────────────────┘     └─────────────────┘
```

### Processing Flow

1. **Chat Route Handling**
   - Route (chat.ts or chat-artifacts.ts) receives user request
   - Extracts parameters (message, history, modelProvider)
   - Initializes services and sends status updates

2. **ChatService Processing**
   - Sets provider using LLMService
   - Gets available MCP tools
   - Handles history formatting for provider
   - Manages response formatting for consistency

3. **Sequential Thinking**
   - Executes multi-step reasoning process
   - Uses provider-specific tool adapters
   - Manages workingMessages array with custom properties
   - Executes tool calls when needed

4. **Tool Execution**
   - Uses MCPService to execute tools
   - Extracts tool calls using provider-specific adapters
   - Formats tool results for adding to conversation
   - Adds results back to workingMessages

5. **Specialized Data Extraction**
   - Extracts bibliography from tool results
   - Processes knowledge graphs and merges if needed
   - Collects direct artifacts from tool responses
   - Processes binary outputs when present
   - Stores data in workingMessages (using as any type assertions)

6. **Artifact Collection**
   - Unified collection phase gathers all artifacts
   - Bibliography, knowledge graphs, direct artifacts processed
   - Artifacts formatted for final response

7. **Response Formatting**
   - Uses formatter adapter for provider-specific output
   - Formats response in consistent StoreFormat
   - Enhances response with all collected artifacts
   - Returns standardized response to client

## Adapter Pattern Implementation

```
┌───────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐
│                   │     │                       │     │                       │
│  Provider API     │────▶│  Adapter              │────▶│  Unified Interface    │
│  Specific Format  │     │  (Provider-specific)  │     │  (App-specific)       │
│                   │     │                       │     │                       │
└───────────────────┘     └───────────────────────┘     └───────────────────────┘
```

### Key Adapter Types

1. **Tool Call Adapters**
   - Convert between MCP tool format and provider-specific format
   - Extract tool calls from provider-specific responses
   - Format tool results for provider-specific continuation
   - Example: OpenAI expects `function` objects, Anthropic uses `input_schema`

2. **Response Formatter Adapters**
   - Format final responses in consistent structure
   - Extract formatted output from provider-specific responses
   - Convert to unified StoreFormat for client
   - Handle provider-specific quirks in response structure

3. **History Formatters**
   - Format chat history for provider requirements
   - Handle system messages appropriately per provider
   - Maintain consistent conversation context

## Type Extensions and Methods

The implementation uses dynamic property extensions on arrays for specialized data:

```typescript
// Conceptual model - actual implementation uses type assertions
const workingMessages: ChatMessage[] = [
  { role: 'user', content: 'message' },
  // ... more messages
];

// Special properties added dynamically
(workingMessages as any).bibliography = [/* bibliography entries */];
(workingMessages as any).knowledgeGraph = {/* knowledge graph */};
(workingMessages as any).directArtifacts = [/* artifacts */];
```

This approach follows the pattern established in chat.ts for collecting and processing specialized data types while maintaining the array structure for messages.

## Conclusion

This high-level model illustrates how the multi-provider implementation handles LLM selection and request processing. The architecture uses adapters to normalize differences between providers while maintaining a consistent interface for the application. The sequential thinking process and artifact handling mirror the original chat.ts implementation but generalize it to work with any provider.

The modular design allows for adding additional providers by creating new provider classes and adapters without changing the core processing logic. 