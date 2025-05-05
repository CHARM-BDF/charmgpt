/**
 * OpenAI Response Formatter Adapter
 * 
 * This file implements the response formatter adapter for OpenAI.
 */

import { ResponseFormatterAdapter, FormatterOutput } from './types';
import { StoreFormat } from '../../message';
import crypto from 'crypto';

/**
 * Response formatter adapter for OpenAI
 */
export class OpenAIResponseFormatterAdapter implements ResponseFormatterAdapter {
  /**
   * Get the OpenAI-specific tool definition for response formatter
   */
  getResponseFormatterToolDefinition(): any {
    return {
      type: "function",
      function: {
        name: "response_formatter",
        description: "Format all responses in a consistent JSON structure with direct array values, not string-encoded JSON",
        parameters: {
          type: "object",
          properties: {
            thinking: {
              type: "string",
              description: "Optional internal reasoning process, formatted in markdown"
            },
            conversation: {
              type: "array",
              description: "Array of conversation segments and artifacts in order of appearance. Return as a direct array, not as a string-encoded JSON.",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["text", "artifact"],
                    description: "Type of conversation segment"
                  },
                  content: {
                    type: "string",
                    description: "Markdown formatted text content"
                  },
                  artifact: {
                    type: "object",
                    description: "Artifact details",
                    properties: {
                      type: {
                        type: "string",
                        enum: [
                          "text/markdown",
                          "application/vnd.ant.code",
                          "image/svg+xml",
                          "application/vnd.mermaid",
                          "text/html",
                          "application/vnd.react",
                          "application/vnd.bibliography",
                          "application/vnd.knowledge-graph"
                        ]
                      },
                      title: { type: "string" },
                      content: { type: "string" },
                      language: { type: "string" }
                    },
                    required: ["type", "title", "content"]
                  }
                },
                required: ["type"]
              }
            }
          },
          required: ["conversation"]
        }
      }
    };
  }
  
  /**
   * Extract formatter output from OpenAI response
   */
  extractFormatterOutput(response: any): FormatterOutput {
    console.log('🔍 DEBUG-OPENAI-FORMATTER: Extracting formatter output from OpenAI response');
    
    // Log the response structure for debugging
    console.log('🔍 DEBUG-OPENAI-FORMATTER: Response structure:', JSON.stringify({
      hasChoices: !!response.choices,
      choicesLength: response.choices?.length || 0,
      hasMessage: !!response.choices?.[0]?.message,
      hasToolCalls: !!response.choices?.[0]?.message?.tool_calls,
      toolCallsLength: response.choices?.[0]?.message?.tool_calls?.length || 0
    }));
    
    // Check if response has tool calls
    if (!response.choices || 
        !response.choices[0]?.message?.tool_calls || 
        response.choices[0].message.tool_calls.length === 0) {
      console.error('❌ DEBUG-OPENAI-FORMATTER: Missing tool calls in response');
      
      // Log the content if there is no tool call
      if (response.choices?.[0]?.message?.content) {
        console.log('🔍 DEBUG-OPENAI-FORMATTER: Response contains content instead of tool calls:', 
          response.choices[0].message.content.substring(0, 200) + '...');
      }
      
      throw new Error('Expected response_formatter tool call from OpenAI');
    }
    
    // Get first tool call
    const toolCall = response.choices[0].message.tool_calls[0];
    console.log(`🔍 DEBUG-OPENAI-FORMATTER: Found tool call: ${toolCall.function.name}`);
    
    // Verify it's the response_formatter tool
    if (toolCall.function.name !== "response_formatter") {
      console.error(`❌ DEBUG-OPENAI-FORMATTER: Wrong tool call: ${toolCall.function.name}`);
      throw new Error(`Expected response_formatter tool, got ${toolCall.function.name}`);
    }
    
    try {
      // Log the raw arguments
      console.log('🔍 DEBUG-OPENAI-FORMATTER: Raw arguments:', toolCall.function.arguments.substring(0, 200) + '...');
      
      // Parse the arguments JSON string
      const formatterOutput = JSON.parse(toolCall.function.arguments);
      
      // Log the parsed structure
      console.log('🔍 DEBUG-OPENAI-FORMATTER: Parsed formatter output structure:', JSON.stringify({
        hasThinking: !!formatterOutput.thinking,
        hasConversation: !!formatterOutput.conversation,
        isConversationArray: Array.isArray(formatterOutput.conversation),
        conversationLength: Array.isArray(formatterOutput.conversation) ? formatterOutput.conversation.length : 0
      }));
      
      // Validate basic structure
      if (!formatterOutput.conversation || !Array.isArray(formatterOutput.conversation)) {
        console.error('❌ DEBUG-OPENAI-FORMATTER: Invalid formatter output structure');
        throw new Error('Invalid formatter output structure: missing conversation array');
      }
      
      console.log('✅ DEBUG-OPENAI-FORMATTER: Successfully extracted formatter output');
      return formatterOutput;
    } catch (error) {
      console.error('❌ DEBUG-OPENAI-FORMATTER: Error parsing OpenAI formatter output:', error);
      throw new Error(`Failed to parse OpenAI formatter output: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Convert formatter output to store format
   */
  convertToStoreFormat(formatterOutput: FormatterOutput): StoreFormat {
    console.log(`🔍 DEBUG-OPENAI-FORMATTER: Converting formatter output to store format`);
    
    // Process conversation items into the expected format
    const processedConversation: Array<{type: string; content?: string; artifact?: any}> = [];
    const artifacts: Array<any> = [];
    let position = 0;
    
    // Process conversation items
    if (formatterOutput.conversation && Array.isArray(formatterOutput.conversation)) {
      console.log(`🔍 DEBUG-OPENAI-FORMATTER: Processing ${formatterOutput.conversation.length} conversation items`);
      
      formatterOutput.conversation.forEach(item => {
        if (item.type === 'text' && item.content) {
          // Add text content to processed conversation
          processedConversation.push({
            type: 'text',
            content: item.content
          });
        } 
        else if (item.type === 'artifact' && item.artifact) {
          // Generate unique ID for artifact
          const uniqueId = crypto.randomUUID();
          
          // Add artifact to the artifacts array
          artifacts.push({
            id: uniqueId,
            artifactId: uniqueId,
            type: item.artifact.type,
            title: item.artifact.title,
            content: item.artifact.content,
            position: position++,
            language: item.artifact.language
          });
          
          // Add artifact reference to conversation
          processedConversation.push({
            type: 'artifact',
            artifact: {
              id: uniqueId,
              type: item.artifact.type,
              title: item.artifact.title,
              content: item.artifact.content,
              language: item.artifact.language
            }
          });
        }
      });
    }
    
    console.log(`🔍 DEBUG-OPENAI-FORMATTER: Processed ${processedConversation.length} conversation items and ${artifacts.length} artifacts`);
    
    // Return the store format with array-structured conversation items
    return {
      thinking: formatterOutput.thinking,
      conversation: processedConversation,
      artifacts: artifacts.length > 0 ? artifacts : undefined
    };
  }
  
  /**
   * Create HTML button for artifact
   */
  private createArtifactButton(id: string, type: string, title: string): string {
    return `<button class="artifact-button text-sm text-blue-600 dark:text-blue-400 hover:underline" data-artifact-id="${id}" data-artifact-type="${type}" style="cursor: pointer; background: none; border: none; padding: 0;">📎 ${title}</button>`;
  }
} 