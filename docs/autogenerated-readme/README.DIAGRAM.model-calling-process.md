# LLM Model Calling Process & Data Flow Diagram

## Overview of ChatService Architecture

```mermaid
graph TD
    User[User Request] --> ChatService
    ChatService --> ProcessChat[processChat Method]
    ProcessChat --> SequentialThinking[1. Sequential Thinking]
    SequentialThinking --> FormatterStep[2. Formatter LLM Step]
    FormatterStep --> ArtifactCollection[3. Artifact Collection]
    ArtifactCollection --> StoreFormat[4. Final StoreFormat]
    StoreFormat --> UI[UI Rendering]
```

## Model Calling Process (By Provider)

### Common Process Flow

```mermaid
graph TD
    UserQuery[User Query] --> HistoryFormatting[Format Chat History]
    HistoryFormatting --> ToolsSetup[Get & Format Tools]
    ToolsSetup --> SystemPrompt[Build System Prompt]
    SystemPrompt --> LLMQuery[Query LLM Provider]
    LLMQuery --> ToolCallExtraction[Extract Tool Calls]
    ToolCallExtraction --> ToolExecution[Execute Tools]
    ToolExecution --> ResultProcessing[Process Results]
    ResultProcessing --> NextStep{Continue?}
    NextStep -->|Yes| SystemPrompt
    NextStep -->|No| FormatterStep[Formatter LLM Step]
```

### Provider-Specific Variations

#### 1. OpenAI (GPT-4, etc.)

```mermaid
graph TD
    PrepareOpenAI[Prepare OpenAI Request] --> Tools[Convert Tools to OpenAI Format]
    Tools --> ToolChoice[toolChoice: "auto" or specific]
    ToolChoice --> SystemPrompt[System Prompt]
    SystemPrompt --> QueryOpenAI[Query OpenAI API]
    QueryOpenAI --> ExtractCalls[Extract function_call from response]
    ExtractCalls --> ProcessResults[Process Tool Results]
    
    subgraph FormatterStep
        PrepFormat[Prepare Formatter Request] --> FormatterTool[Single response_formatter tool]
        FormatterTool --> ForceToolChoice[toolChoice: {type: 'tool', name: 'response_formatter'}]
        ForceToolChoice --> QueryFormatter[Query OpenAI with Formatter]
        QueryFormatter --> ExtractFormat[Extract from function_call]
        ExtractFormat --> OpenAIAdapter[OpenAIResponseFormatterAdapter]
        OpenAIAdapter --> ConvertStore[convertToStoreFormat]
    end
```

#### 2. Anthropic (Claude)

```mermaid
graph TD
    PrepareAnthropic[Prepare Anthropic Request] --> Tools[Convert Tools to Anthropic Format]
    Tools --> SystemPrompt[System Prompt]
    SystemPrompt --> QueryAnthropic[Query Anthropic API]
    QueryAnthropic --> ExtractCalls[Extract tool_use blocks]
    ExtractCalls --> ProcessResults[Process Tool Results]
    
    subgraph FormatterStep
        PrepFormat[Prepare Formatter Request] --> FormatterTool[Single response_formatter tool]
        FormatterTool --> ForceToolChoice[toolChoice: {name: 'response_formatter'}]
        ForceToolChoice --> QueryFormatter[Query Anthropic with Formatter]
        QueryFormatter --> ExtractFormat[Extract from tool_use]
        ExtractFormat --> AnthropicAdapter[AnthropicResponseFormatterAdapter]
        AnthropicAdapter --> ConvertStore[convertToStoreFormat]
    end
```

#### 3. Gemini

```mermaid
graph TD
    PrepareGemini[Prepare Gemini Request] --> Tools[Convert Tools to Gemini Format]
    Tools --> SystemPrompt[System Prompt]
    SystemPrompt --> QueryGemini[Query Gemini API]
    QueryGemini --> ExtractCalls[Extract function calls]
    ExtractCalls --> ProcessResults[Process Tool Results]
    
    subgraph FormatterStep
        PrepFormat[Prepare Formatter Request] --> FormatterTool[Single response_formatter tool]
        FormatterTool --> QueryFormatter[Query Gemini with Formatter]
        QueryFormatter --> ExtractFormat[Extract functionCalls]
        ExtractFormat --> GeminiAdapter[GeminiResponseFormatterAdapter]
        GeminiAdapter --> ConvertStore[convertToStoreFormat - Joins text!]
    end
```

#### 4. Ollama (Local Models)

```mermaid
graph TD
    PrepareOllama[Prepare Ollama Request] --> Tools[Convert Tools to Ollama Format]
    Tools --> SystemPrompt[System Prompt]
    SystemPrompt --> QueryOllama[Query Ollama API]
    QueryOllama --> ExtractCalls[Extract tool calls]
    ExtractCalls --> ProcessResults[Process Tool Results]
    
    subgraph FormatterStep
        PrepFormat[Prepare Formatter Request] --> FormatterTool[Single response_formatter tool]
        FormatterTool --> QueryFormatter[Query Ollama with Formatter]
        QueryFormatter --> ExtractFormat[Extract from response]
        ExtractFormat --> OllamaAdapter[OllamaResponseFormatterAdapter]
        OllamaAdapter --> ConvertStore[convertToStoreFormat]
    end
```

## Tool Execution Flow

```mermaid
graph TD
    ToolCall[Tool Call Extracted] --> OriginalName[Get Original Tool Name]
    OriginalName --> SplitName[Split into Server:Tool]
    SplitName --> MCPCall[MCP Service Call]
    MCPCall --> ToolResult[Tool Result]
    
    ToolResult --> ProcessText[Process Text Content]
    ToolResult --> ProcessBibliography[Process Bibliography]
    ToolResult --> ProcessKnowledgeGraph[Process Knowledge Graph]
    ToolResult --> ProcessArtifacts[Process Artifacts]
    ToolResult --> ProcessBinaryOutputs[Process Binary Outputs]
    
    ProcessText --> AddToMessages[Add to Working Messages]
    ProcessBibliography --> AddToBibliography[Add to Bibliography]
    ProcessKnowledgeGraph --> MergeWithExisting[Merge with Existing Graph]
    ProcessArtifacts --> StoreArtifacts[Store Direct Artifacts]
    ProcessBinaryOutputs --> StoreOutputs[Store Binary Outputs]
```

## Data Transformation Flow

```mermaid
graph TD
    FormatterOutput[Formatter Output] --> ConvertToStore[Convert to StoreFormat]
    
    subgraph Text Processing
        TextItems[Text Items] --> ConvertGemini[Gemini: Join into single string]
        TextItems --> ConvertOthers[OpenAI/Anthropic: Keep as array]
        ConvertGemini --> SingleText[Single Text String]
        ConvertOthers --> ArrayItems[Array of Items]
    end
    
    subgraph Artifact Processing
        ArtifactItems[Artifact Items] --> GenerateIDs[Generate Unique IDs]
        GenerateIDs --> TrackPosition[Track Position]
        TrackPosition --> CreateButtons[Create Button References]
        CreateButtons --> ArtifactsList[Artifacts List]
    end
    
    ConvertToStore --> EnhanceWithArtifacts[Enhance with Additional Artifacts]
    EnhanceWithArtifacts --> FinalResponse[Final Response]
```

## Key Issues & Fix Implementation

```mermaid
graph TD
    Issue[Issue: OpenAI/Anthropic adapters don't join text] --> Solution[Solution: Update convertToStoreFormat]
    
    Solution --> CurrentOpenAI[Current OpenAI Format:<br>conversation: array of items]
    Solution --> FixedOpenAI[Fixed OpenAI Format:<br>conversation: joined string]
    
    CurrentOpenAI -->|Problem| UIDisplay[UI only displays last item]
    FixedOpenAI -->|Solution| UIWorks[UI displays complete text<br>plus artifacts]
    
    subgraph Implementation Steps
        UpdateAdapters[1. Update OpenAI adapter] --> JoinText[Join text segments]
        JoinText --> MaintainIDs[Maintain artifact ID generation]
        MaintainIDs --> AddReferences[Add artifact references]
        AddReferences --> TestAll[Test with all providers]
    end
``` 