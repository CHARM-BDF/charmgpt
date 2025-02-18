# LLM Model Selection Implementation Plan

## Overview
Add the ability to switch between different LLM providers (Anthropic, Ollama, etc.) in the CHARM MCP application.

## Current Architecture
- Server uses Anthropic's Claude model directly
- Configuration is hardcoded in server implementation
- Chat processing happens in `src/server/index.ts`
- State management via Zustand stores (`chatStore.ts` and `mcpStore.ts`)

## Implementation Progress

### ✅ Phase 1: Core Infrastructure (COMPLETED)

#### 1. LLM Types and Interfaces (`src/types/llm.ts`)
```typescript
// Core configuration interface
export interface LLMConfig {
    provider: 'anthropic' | 'ollama';
    model: string;
    apiKey?: string;
    endpoint?: string;
    parameters: {
        temperature: number;
        maxTokens: number;
        [key: string]: any;
    };
}

// Provider interface that all LLM providers must implement
export interface LLMProvider {
    name: string;
    config: LLMConfig;
    generateResponse(messages: Message[], tools: any[]): Promise<any>;
    formatResponse(response: any): FormatterInput;
}
```

#### 2. Base Provider Class (`src/llm/providers/base.ts`)
```typescript
export abstract class BaseLLMProvider implements LLMProvider {
    // Common functionality:
    // - Configuration validation
    // - Error formatting
    // - Resource cleanup
    // - Provider initialization
}
```

#### 3. LLM Store (`src/store/llmStore.ts`)
```typescript
interface LLMStoreState {
    currentConfig: LLMConfig;
    availableProviders: Provider[];
    availableModels: Record<Provider, string[]>;
    providerStatus: Record<Provider, ProviderStatus>;
    // ... actions and state management
}
```

### 🔄 Phase 2: Provider Implementation (IN PROGRESS)

#### 1. Anthropic Provider (`src/llm/providers/anthropic.ts`) ✅
```typescript
export class AnthropicProvider extends BaseLLMProvider {
    private client: Anthropic;

    // Features:
    // - Anthropic-specific configuration validation
    // - Message format conversion
    // - Error handling
    // - Response formatting
    // - Tool support
}
```

Key Implementation Details:
- Proper error handling with type checking
- Consistent response formatting
- Provider-specific validation
- Tool support maintenance
- API key management

#### 2. Ollama Provider (TODO)
- Will follow same pattern as Anthropic provider
- Need to implement Ollama-specific:
  - Configuration validation
  - API communication
  - Response formatting
  - Error handling

#### 3. Provider Factory (TODO)
- Will handle provider instantiation
- Validate configurations
- Manage provider lifecycle

### Remaining Phases (TODO)

#### Phase 3: Server Updates
- Refactor server to use provider interface
- Add configuration endpoints
- Update chat processing
- Add error handling

#### Phase 4: UI Integration
- Create selector components
- Add configuration UI
- Implement status display
- Add provider settings

#### Phase 5: Testing & Documentation
- Add integration tests
- Update documentation
- Add configuration guide
- Create migration guide

## Required Changes

### New Files Created ✅
1. `src/types/llm.ts` - Core types and interfaces
2. `src/llm/providers/base.ts` - Base provider implementation
3. `src/store/llmStore.ts` - State management for LLM configuration
4. `src/llm/providers/anthropic.ts` - Anthropic provider implementation

### New Files Pending
1. `src/llm/providers/ollama.ts`
2. `src/llm/factory.ts`
3. `src/components/llm/LLMSelector.tsx`
4. `src/components/llm/LLMConfig.tsx`

### Files to Modify
1. `src/server/index.ts`
2. `src/store/chatStore.ts`
3. `src/types/mcp.ts`
4. `src/components/chat/ChatInterface.tsx`

## Configuration Example
```json
{
    "llm": {
        "providers": {
            "anthropic": {
                "models": ["claude-3-opus-20240229", "claude-3-sonnet-20240229"],
                "defaultModel": "claude-3-sonnet-20240229",
                "requiresApiKey": true
            },
            "ollama": {
                "models": ["llama2", "mistral", "codellama"],
                "defaultModel": "codellama",
                "requiresEndpoint": true,
                "defaultEndpoint": "http://localhost:11434"
            }
        },
        "defaultProvider": "anthropic"
    }
}
```

## Implementation Notes
- Each provider implementation follows the same pattern but handles provider-specific details
- Error handling is consistent across providers
- Configuration validation happens at multiple levels:
  1. Base provider validation (common parameters)
  2. Provider-specific validation
  3. Runtime validation
- Response formatting ensures consistent structure regardless of provider
- State management handles:
  1. Provider configuration
  2. Model selection
  3. Provider status
  4. Error state

## Next Steps
1. Complete Ollama provider implementation
2. Create provider factory
3. Begin server refactoring
4. Start UI component development 