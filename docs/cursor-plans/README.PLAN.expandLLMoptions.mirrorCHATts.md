# ChatService Improvement Plan: Mirroring chat.ts Artifact Handling

## Context
- **Purpose**: This document outlines a plan to enhance ChatService to better handle artifacts from MCP server responses
- **Reference Implementation**: `src/server/routes/chat.ts` which has a proven approach to artifact handling
- **Related Documents**: 
  - [README.PLAN.expandLLMoptions.md](./README.PLAN.expandLLMoptions.md) - Overall multi-provider strategy
  - [README.PLAN.expandLLMoptions.ChatService.md](./README.PLAN.expandLLMoptions.ChatService.md) - Chat service architecture
  - [README.PLAN.expandLLMoptions.TOOL-SELECTION-FIX.md](./README.PLAN.expandLLMoptions.TOOL-SELECTION-FIX.md) - Tool selection fix
  - [README.PLAN.expandLLMoptions.RESPONSE-FORMATTER-FIX.md](./README.PLAN.expandLLMoptions.RESPONSE-FORMATTER-FIX.md) - Response formatter fix

## Current Issue
The ChatService implementation successfully extracts text content from MCP tool responses, but fails to properly handle and preserve other types of data, such as:
- Bibliography data
- Knowledge graphs
- Raw artifacts
- Binary outputs

This leads to a discrepancy between what users see in the UI when using the original chat.ts implementation versus the new ChatService implementation.

## Analysis of chat.ts vs ChatService

### Key Differences in Handling MCP Tool Responses

1. **Detailed Content Extraction**
   - `chat.ts`: Uses specific logic to extract different types of content from tool responses
   - `ChatService`: Only extracts text content from the response

2. **Specialized Artifact Storage**
   - `chat.ts`: Stores specialized artifacts like bibliography, knowledge graphs, and direct artifacts in the `messages` object for later processing
   - `ChatService`: Does not maintain collections of different artifact types

3. **Unified Artifact Collection**
   - `chat.ts`: Has a final phase that collects all artifacts and enhances the response in one operation
   - `ChatService`: Processes each tool result individually without a unified collection step

### Comparison of Sequential Thinking Process

The sequential thinking implementations in both files have similar structures but important differences:

1. **Loop Structure**:
   - `chat.ts`: Uses a simple `while` loop with a flag to track completion
   - `ChatService`: Also uses a `while` loop but includes a safety limit of MAX_THINKING_STEPS

2. **Tool Call Retrieval**:
   - `chat.ts`: Directly examines `toolResponse.content` array items with type 'tool_use'
   - `ChatService`: Uses a tool adapter pattern to extract tool calls via `toolAdapter.extractToolCalls(response.rawResponse)`

3. **Tool Result Processing**:
   - `chat.ts`: Handles specialized results like bibliography, knowledge graphs, etc. directly
   - `ChatService`: Only extracts text content, ignoring specialized data structures

4. **Conversation Building**:
   - `chat.ts`: Adds both tools and results to the conversation with proper role assignments
   - `ChatService`: Similarly adds tool usage and results as assistant/user messages

5. **Final Step**:
   - `chat.ts`: Updates a flag directly when processing a sequential-thinking tool result or when no tool calls are present
   - `ChatService`: Similar logic, but adds the original message for the final response

6. **Request Repetition**:
   - `chat.ts`: Repeats the original message in the final step to get a complete response
   - `ChatService`: Same approach, adds the original message at the end for the final thinking-informed response

7. **Message Structure**:
   - `chat.ts`: Uses a more flexible structure with message metadata for storing artifacts, bibliography, etc.
   - `ChatService`: Uses a simpler message structure without capturing artifacts and specialized data

The key functional difference is that while the overall flow is similar, `chat.ts` collects and preserves specialized data during the sequential thinking process, whereas `ChatService` only preserves the text content of tool responses.

## Implementation Plan

### 1. Enhanced Tool Result Extraction

Update the `runSequentialThinking` method to extract and store various types of data from tool results:

```typescript
// Process tool result
if (toolResult && typeof toolResult === 'object' && 'content' in toolResult) {
  // Extract text content for conversation
  const textContent = Array.isArray(toolResult.content) 
    ? toolResult.content.find((item: any) => item.type === 'text')?.text 
    : toolResult.content;
    
  if (textContent) {
    workingMessages.push({
      role: 'user',
      content: textContent
    });
  }
  
  // Handle bibliography if present
  if ('bibliography' in toolResult && toolResult.bibliography) {
    if (!(workingMessages as any).bibliography) {
      (workingMessages as any).bibliography = [];
    }
    
    // Merge bibliography entries, avoiding duplicates
    const currentBibliography = (workingMessages as any).bibliography;
    const newBibliography = toolResult.bibliography as any[];
    
    // Create a map of existing PMIDs
    const existingPmids = new Set(currentBibliography.map(entry => entry.pmid));
    
    // Only add entries with new PMIDs
    const uniqueNewEntries = newBibliography.filter(entry => !existingPmids.has(entry.pmid));
    
    // Merge unique new entries with existing bibliography
    (workingMessages as any).bibliography = [...currentBibliography, ...uniqueNewEntries];
  }
  
  // Handle knowledge graph artifacts
  if ('artifacts' in toolResult && Array.isArray(toolResult.artifacts)) {
    // Find any knowledge graph artifacts in the response
    const knowledgeGraphArtifact = toolResult.artifacts.find((a: any) => 
      a.type === 'application/vnd.knowledge-graph' && typeof a.content === 'string'
    );
    
    if (knowledgeGraphArtifact) {
      try {
        // Parse the knowledge graph content from string to object
        const newGraph = JSON.parse(knowledgeGraphArtifact.content);
        
        // Store or merge the knowledge graph
        if ((workingMessages as any).knowledgeGraph) {
          // Merge logic would go here
          (workingMessages as any).knowledgeGraph = mergeKnowledgeGraphs(
            (workingMessages as any).knowledgeGraph,
            newGraph
          );
        } else {
          (workingMessages as any).knowledgeGraph = newGraph;
        }
      } catch (error) {
        console.error('Error processing knowledge graph:', error);
      }
    }
  }
  
  // Store direct artifacts
  if ('artifacts' in toolResult && Array.isArray(toolResult.artifacts)) {
    if (!(workingMessages as any).directArtifacts) {
      (workingMessages as any).directArtifacts = [];
    }
    
    for (const artifact of toolResult.artifacts) {
      (workingMessages as any).directArtifacts.push(artifact);
    }
  }
  
  // Handle binary output if present
  if ('binaryOutput' in toolResult && toolResult.binaryOutput) {
    if (!(workingMessages as any).binaryOutputs) {
      (workingMessages as any).binaryOutputs = [];
    }
    
    (workingMessages as any).binaryOutputs.push(toolResult.binaryOutput);
  }
}
```

### 2. Unified Artifact Collection Phase

Modify the `processChat` method to include a unified artifact collection phase:

```typescript
// After sequential thinking is complete and before the formatter
// Collect all artifacts into one unified collection
let artifactsToAdd = [];

// Add bibliography if present
if ((processedHistory as any).bibliography) {
  artifactsToAdd.push({
    type: 'application/vnd.bibliography',
    title: 'Bibliography',
    content: (processedHistory as any).bibliography
  });
}

// Add knowledge graph if present
if ((processedHistory as any).knowledgeGraph) {
  artifactsToAdd.push({
    type: 'application/vnd.knowledge-graph',
    title: 'Knowledge Graph',
    content: (processedHistory as any).knowledgeGraph
  });
}

// Add direct artifacts if present
if ((processedHistory as any).directArtifacts) {
  for (const artifact of (processedHistory as any).directArtifacts) {
    artifactsToAdd.push(artifact);
  }
}

// Process binary outputs if present
if ((processedHistory as any).binaryOutputs) {
  for (const binaryOutput of (processedHistory as any).binaryOutputs) {
    // Use artifact service to get processed artifacts
    const processedArtifacts = this.artifactService.processBinaryOutput(binaryOutput, 0);
    
    // Add each processed artifact
    for (const artifact of processedArtifacts) {
      artifactsToAdd.push({
        type: artifact.type,
        title: artifact.title,
        content: artifact.content,
        language: artifact.language
      });
    }
  }
}

// Apply all artifacts in one operation after getting the formatter response
if (artifactsToAdd.length > 0) {
  storeFormat = this.messageService.enhanceResponseWithArtifacts(
    storeFormat,
    artifactsToAdd
  );
}
```

### 3. Adding Required Dependencies

Ensure the ChatService has access to all required dependencies:

```typescript
export class ChatService {
  private llmService: LLMService;
  private mcpService?: MCPService;
  private messageService: MessageService;
  private artifactService: ArtifactService;
  
  constructor(
    llmService: LLMService, 
    mcpService?: MCPService,
    messageService?: MessageService,
    artifactService?: ArtifactService
  ) {
    this.llmService = llmService;
    this.mcpService = mcpService;
    this.messageService = messageService || new MessageService();
    this.artifactService = artifactService || new ArtifactService();
  }
  
  // ... rest of the implementation
}
```

## Implementation Steps

1. **Update Type Definitions**:
   - Add extended types for working messages to include artifact collections
   - Import required utility functions like `mergeKnowledgeGraphs`

2. **Enhance Tool Execution Handling**:
   - Update runSequentialThinking to extract and store different artifact types
   - Add appropriate logging for artifact extraction

3. **Add Unified Artifact Collection**:
   - Implement the collection phase in processChat
   - Ensure all artifact types are properly formatted

4. **Update Test Cases**:
   - Create tests for PubMed search and bibliography handling
   - Test different artifact types and collection

## Expected Outcomes

After implementing these changes, the ChatService should:

1. Properly handle all types of artifacts from MCP tool responses
2. Maintain consistency with the original chat.ts implementation
3. Provide rich, structured responses to the UI
4. Display bibliographies, knowledge graphs, and other artifacts correctly

This approach will ensure that the new multi-provider ChatService implementation matches the capabilities and output quality of the original implementation while adding the flexibility to work with different LLM providers.

## Testing Strategy

Test the implementation with these specific cases:

1. **PubMed Search**:
   - Search for papers on a specific topic
   - Verify bibliography artifact is created and displayed
   
2. **Knowledge Graph**:
   - Use a tool that generates a knowledge graph
   - Verify the graph is preserved and displayed
   
3. **Multiple Artifacts**:
   - Use tools that generate multiple artifact types
   - Verify all artifacts are collected and displayed properly
   
4. **Cross-Provider Testing**:
   - Verify the artifact handling works consistently across all LLM providers 