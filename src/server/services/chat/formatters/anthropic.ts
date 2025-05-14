/**
 * Anthropic Response Formatter Adapter
 * 
 * This file implements the response formatter adapter for Anthropic (Claude).
 */

import { ResponseFormatterAdapter, FormatterOutput } from './types';
import { StoreFormat } from '../../message';
import crypto from 'crypto';

/**
 * Response formatter adapter for Anthropic (Claude)
 */
export class AnthropicResponseFormatterAdapter implements ResponseFormatterAdapter {
  /**
   * Get the Anthropic-specific tool definition for response formatter
   */
  getResponseFormatterToolDefinition(): any {
    return {
      name: "response_formatter",
      description: "Format all responses in a consistent JSON structure with direct array values, not string-encoded JSON",
      input_schema: {
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
    };
  }
  
  /**
   * Get the tool choice object for the response formatter
   * This is a separate method to make it clear what the tool choice should be
   */
  getResponseFormatterToolChoice(): any {
    return {
      type: "tool",
      name: "response_formatter"
    };
  }
  
  /**
   * Extract formatter output from Anthropic response
   */
  extractFormatterOutput(response: any): FormatterOutput {
    console.log('🔍 DEBUG-ANTHROPIC-FORMATTER: Extracting formatter output from Anthropic response');
    
    // Log the response structure for debugging
    console.log('🔍 DEBUG-ANTHROPIC-FORMATTER: Response structure:', JSON.stringify({
      hasContent: !!response.content,
      contentLength: response.content?.length || 0,
      contentTypes: response.content?.map((block: any) => block.type).join(', ') || 'none'
    }));
    
    // Check if response has content
    if (!response.content || response.content.length === 0) {
      console.warn('⚠️ DEBUG-ANTHROPIC-FORMATTER: Empty response from Anthropic');
      
      // Return fallback formatter output
      return {
        thinking: "Anthropic returned an empty response",
        conversation: [{
          type: 'text',
          content: "The model did not return any content. Please try again."
        }]
      };
    }
    
    // Find tool_use content block
    const toolUseBlock = response.content.find((block: any) => 
      block.type === 'tool_use' && block.name === 'response_formatter'
    );
    
    // If no tool_use block, look for text content as fallback
    if (!toolUseBlock) {
      console.warn('⚠️ DEBUG-ANTHROPIC-FORMATTER: No response_formatter tool use found - falling back to text content');
      
      // Find text blocks
      const textBlocks = response.content
        .filter((block: any) => block.type === 'text' && block.text)
        .map((block: any) => block.text);
      
      if (textBlocks.length > 0) {
        console.log(`🔍 DEBUG-ANTHROPIC-FORMATTER: Found ${textBlocks.length} text blocks to use as fallback`);
        
        // Return fallback formatter output with combined text
        return {
          thinking: "Response formatted from text content",
          conversation: [{
            type: 'text',
            content: textBlocks.join('\n\n')
          }]
        };
      }
      
      console.error('❌ DEBUG-ANTHROPIC-FORMATTER: No usable content in Anthropic response');
      return {
        thinking: "No usable content in Anthropic response",
        conversation: [{
          type: 'text',
          content: "The model did not provide a properly formatted response. Please try again."
        }]
      };
    }
    
    console.log('🔍 DEBUG-ANTHROPIC-FORMATTER: Found response_formatter tool use');
    
    try {
      // Get formatter output from tool input
      const formatterOutput = toolUseBlock.input;
      
      // Log the parsed structure
      console.log('🔍 DEBUG-ANTHROPIC-FORMATTER: Formatter output structure:', JSON.stringify({
        hasThinking: !!formatterOutput.thinking,
        hasConversation: !!formatterOutput.conversation,
        isConversationArray: Array.isArray(formatterOutput.conversation),
        conversationLength: Array.isArray(formatterOutput.conversation) ? formatterOutput.conversation.length : 0
      }));
      
      // Validate basic structure
      if (!formatterOutput.conversation) {
        console.warn('⚠️ DEBUG-ANTHROPIC-FORMATTER: Missing conversation array - creating fallback');
        
        // Create a fallback conversation array with any available thinking
        return {
          thinking: formatterOutput.thinking || "Formatter output was incomplete",
          conversation: [{
            type: 'text',
            content: formatterOutput.content || formatterOutput.text || "The model didn't provide a properly structured response"
          }]
        };
      }
      
      // If conversation is not an array, convert it to an array
      if (!Array.isArray(formatterOutput.conversation)) {
        console.warn('⚠️ DEBUG-ANTHROPIC-FORMATTER: Conversation is not an array - converting to array');
        
        // Convert string or object conversation to array
        if (typeof formatterOutput.conversation === 'string') {
          formatterOutput.conversation = [{
            type: 'text',
            content: formatterOutput.conversation
          }];
        } else if (typeof formatterOutput.conversation === 'object') {
          formatterOutput.conversation = [formatterOutput.conversation];
        } else {
          formatterOutput.conversation = [{
            type: 'text',
            content: "The model provided an invalid conversation format"
          }];
        }
      }
      
      console.log('✅ DEBUG-ANTHROPIC-FORMATTER: Successfully extracted formatter output');
      return formatterOutput;
    } catch (error) {
      console.error('❌ DEBUG-ANTHROPIC-FORMATTER: Error processing Anthropic formatter output:', error);
      
      // Create a fallback response with error message
      return {
        thinking: "Error processing formatter output",
        conversation: [{
          type: 'text',
          content: `The model response could not be properly formatted. Error: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
  
  /**
   * Convert formatter output to store format
   */
  convertToStoreFormat(formatterOutput: FormatterOutput): StoreFormat {
    console.log(`🔍 DEBUG-ANTHROPIC-FORMATTER: Converting formatter output to store format`);
    
    // Process conversation items into the expected format
    const processedConversation: Array<{type: string; content?: string; artifact?: any}> = [];
    const artifacts: Array<any> = [];
    let position = 0;
    
    // Process conversation items
    if (formatterOutput.conversation && Array.isArray(formatterOutput.conversation)) {
      console.log(`🔍 DEBUG-ANTHROPIC-FORMATTER: Processing ${formatterOutput.conversation.length} conversation items`);
      
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
    
    console.log(`🔍 DEBUG-ANTHROPIC-FORMATTER: Processed ${processedConversation.length} conversation items and ${artifacts.length} artifacts`);
    
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