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
    // Check if response has tool calls
    if (!response.choices || 
        !response.choices[0]?.message?.tool_calls || 
        response.choices[0].message.tool_calls.length === 0) {
      throw new Error('Expected response_formatter tool call from OpenAI');
    }
    
    // Get first tool call
    const toolCall = response.choices[0].message.tool_calls[0];
    
    // Verify it's the response_formatter tool
    if (toolCall.function.name !== "response_formatter") {
      throw new Error(`Expected response_formatter tool, got ${toolCall.function.name}`);
    }
    
    try {
      // Parse the arguments JSON string
      const formatterOutput = JSON.parse(toolCall.function.arguments);
      
      // Validate basic structure
      if (!formatterOutput.conversation || !Array.isArray(formatterOutput.conversation)) {
        throw new Error('Invalid formatter output structure: missing conversation array');
      }
      
      return formatterOutput;
    } catch (error) {
      console.error('Error parsing OpenAI formatter output:', error);
      throw new Error(`Failed to parse OpenAI formatter output: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Convert formatter output to store format
   */
  convertToStoreFormat(formatterOutput: FormatterOutput): StoreFormat {
    const conversation: string[] = [];
    const artifacts: Array<any> = [];
    let position = 0;
    
    // Process conversation items
    if (formatterOutput.conversation && Array.isArray(formatterOutput.conversation)) {
      formatterOutput.conversation.forEach(item => {
        if (item.type === 'text' && item.content) {
          // Add text content to conversation
          conversation.push(item.content);
        } 
        else if (item.type === 'artifact' && item.artifact) {
          // Generate unique ID for artifact
          const uniqueId = crypto.randomUUID();
          
          // Add artifact
          artifacts.push({
            id: uniqueId,
            artifactId: uniqueId,
            type: item.artifact.type,
            title: item.artifact.title,
            content: item.artifact.content,
            position: position++,
            language: item.artifact.language
          });
          
          // Add artifact button to conversation
          conversation.push(this.createArtifactButton(uniqueId, item.artifact.type, item.artifact.title));
        }
      });
    }
    
    return {
      thinking: formatterOutput.thinking,
      conversation: conversation.join('\n\n'),
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