# Sequential Thinking Update Plan
**Created:** May 12, 2025
**Purpose:** Address issues in the tool calling and response generation pipeline where summary content is correctly generated during processing but lost in the final response to the user.

## Background

The current implementation of sequential thinking in the chat service combines data gathering via tool calling and analysis in a single phase. This has led to a specific issue where the LLM correctly creates summaries of gathered data, but the formatter incorrectly assumes this information has already been presented to the user.

As seen in the logs from May 12, 2025, the system successfully searched PubMed and retrieved three papers on cancer, then generated an excellent summary of these papers. However, the final formatter output incorrectly stated "I've already provided summaries for three papers on cancer based on a previous request" even though this summary was never actually presented to the user.

## Implementation Plan

This document outlines the changes required to implement a clear separation between the data gathering phase and the analysis phase in the sequential thinking process.

### 1. Refactor Architecture

#### A. Split Sequential Thinking Pipeline

Modify the `runSequentialThinking` method to separate responsibilities:

```typescript
async runSequentialThinking(...) {
  // Phase 1: Data Gathering
  const gatheredData = await this.gatherDataWithTools(message, history, tools);
  
  // Decision point: Do we have enough data?
  if (this.isDataSufficient(gatheredData, message)) {
    // Phase 2: Analysis
    const analysis = await this.performAnalysis(gatheredData, message);
    
    // Add metadata indicating this is new content
    analysis.metadata = { isNewToUser: true };
    
    return analysis;
  } else {
    // Continue gathering data if needed
    return this.continueDataGathering(gatheredData, message);
  }
}
```

#### B. Create New Analysis Method

Add a dedicated method for the analysis phase:

```typescript
async performAnalysis(gatheredData, originalQuestion) {
  // Use LLM to analyze without tool definitions in context
  // Focus only on summarizing/processing the gathered data
  // Mark the output as new content for user
  
  const analysisResponse = await this.llmService.query({
    prompt: originalQuestion,
    options: {
      temperature: options.temperature || 0.2,
      maxTokens: options.maxTokens || 4000,
    },
    systemPrompt: this.buildAnalysisSystemPrompt(gatheredData, originalQuestion)
  });
  
  return {
    ...analysisResponse,
    metadata: { isNewToUser: true }
  };
}
```

#### C. Add State Tracking

Enhance message processing with explicit state tracking:

```typescript
// Update how formatter receives content
const formatterInput = {
  originalQuestion,
  analyzedContent,
  contentMetadata: { isNewToUser: true }
};
```

### 2. System Prompt Updates

#### A. Data Gathering System Prompt

Create a new method for generating the data gathering prompt:

```typescript
private buildToolCallingSystemPrompt(history: ProviderChatMessage[], tools: any[]): string {
  let prompt = "You are an AI assistant focused ONLY on gathering information to answer the user's question.\n\n";
  prompt += "IMPORTANT INSTRUCTIONS:\n";
  prompt += "1. Your ONLY role is to determine what data is needed and use tools to gather it.\n";
  prompt += "2. DO NOT attempt to answer the user's question directly in this phase.\n";
  prompt += "3. Call appropriate tools to collect relevant information.\n";
  prompt += "4. After each tool call, evaluate if you have sufficient data to answer the question.\n";
  prompt += "5. When you believe you have gathered enough information, explicitly state 'DATA GATHERING COMPLETE'.\n";
  prompt += "6. If you need more data, continue making tool calls until sufficient information is collected.\n\n";
  
  // Add tools and history context
  if (history.length > 0) {
    prompt += "# Conversation History\n\n";
    // Add history formatting
  }
  
  if (tools.length > 0) {
    prompt += "# Available Tools\n\n";
    // Add tool formatting
  }
  
  return prompt;
}
```

#### B. Analysis System Prompt

Create a new method for generating the analysis prompt:

```typescript
private buildAnalysisSystemPrompt(history: ProviderChatMessage[], gatheredData: any[]): string {
  let prompt = "You are an AI assistant analyzing previously gathered information to provide a comprehensive response.\n\n";
  prompt += "IMPORTANT INSTRUCTIONS:\n";
  prompt += "1. Focus ONLY on analyzing the data that has been gathered for you.\n";
  prompt += "2. DO NOT attempt to gather additional information - work with what you have.\n";
  prompt += "3. Create a clear, concise, and comprehensive response to the user's original question.\n";
  prompt += "4. Present your analysis as NEW information that the user has not seen before.\n";
  prompt += "5. Make sure to include all relevant details from the gathered data.\n";
  prompt += "6. Format your response appropriately with clear structure and organization.\n\n";
  
  prompt += "# Original Question\n\n";
  // Add original question
  
  prompt += "\n# Gathered Data\n\n";
  // Format and add gathered data
  
  return prompt;
}
```

#### C. Decision Evaluation Prompt

Create a method for the decision point evaluation:

```typescript
private buildDecisionEvaluationPrompt(originalQuestion: string, gatheredData: any[]): string {
  let prompt = "Evaluate if the data gathered so far is sufficient to answer the user's original question.\n\n";
  prompt += "IMPORTANT INSTRUCTIONS:\n";
  prompt += "1. Consider if the gathered information addresses all aspects of the question.\n";
  prompt += "2. Determine if additional data would significantly improve the quality of the response.\n";
  prompt += "3. Return a clear YES/NO decision with brief rationale.\n";
  prompt += "4. If YES, no further data gathering is needed.\n";
  prompt += "5. If NO, specify what additional information would be helpful.\n\n";
  
  prompt += "# Original Question\n\n";
  // Add original question
  
  prompt += "\n# Currently Gathered Data\n\n";
  // Format and add gathered data
  
  return prompt;
}
```

### 3. Formatter Update

Modify the formatter to correctly handle analyzed content:

```typescript
// In formatterAdapter.extractFormatterOutput
// Add logic to check for content metadata
if (formatterOutput?.contentMetadata?.isNewToUser) {
  // Process as new content that should be shown to user
} else {
  // Process as potentially already seen content
}
```

### 4. Implementation Strategy

1. **First Phase**: 
   - Implement the split between data gathering and analysis
   - Update system prompts for clear separation of responsibilities

2. **Second Phase**:
   - Add explicit state tracking
   - Enhance the formatter to respect content metadata

3. **Third Phase**:
   - Add the decision evaluation component
   - Refine based on testing results

### 5. Expected Benefits

1. **Clear Separation of Concerns**: Each phase has a specific, focused responsibility
2. **Reduced Token Overhead**: Not including tool descriptions in the analysis phase
3. **Better State Management**: Explicit tracking of what has been shown to the user
4. **Improved Response Quality**: More focused analysis without distraction from tool definitions
5. **Prevention of Information Loss**: Ensuring valuable generated content reaches the user

### 6. Testing Plan

1. Test with the same cancer research query that revealed the issue
2. Compare formatter output with and without the changes
3. Ensure all summaries and analyses are correctly presented to the user
4. Verify performance across different types of queries
5. Monitor token usage to confirm reduction

### Clarifications and Decisions

1. **Decision Logic for "Is Data Sufficient?"**
   - The decision logic will be handled by the tool-calling process. The system prompt will instruct the tool-calling LLM to focus on gathering data and determining if it's sufficient, without attempting to answer the question itself.
   - A special flag "DATA GATHERING COMPLETE" will be used to indicate when sufficient data has been gathered.

2. **Handling Partial Data**
   - The tool-calling process will attempt additional tool calls if the data is incomplete, leveraging the sequential thinking steps.
   - Artifacts attached in the artifact array won't be seen by the analysis LLM step.

3. **Analysis Phase Verbosity**
   - The verbosity of the analysis phase will not be instructed upon; the user may decide on this aspect.

4. **Priority for Implementation**
   - The priority is on improving accuracy over reducing token usage.

These clarifications ensure that the implementation plan is aligned with the desired outcomes and user preferences.

## Conclusion

This update addresses a significant issue in the sequential thinking pipeline by clearly separating data gathering from analysis and adding explicit state tracking. The changes maintain the overall architecture while making targeted modifications to improve the user experience and ensure valuable content is not lost between processing steps. 