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
   * Extract formatter output from Anthropic response
   */
  extractFormatterOutput(response: any): FormatterOutput {
    // Check if response has content and tool_use
    if (!response.content || response.content.length === 0) {
      throw new Error('Empty response from Anthropic');
    }
    
    // Find tool_use content block
    const toolUseBlock = response.content.find((block: any) => 
      block.type === 'tool_use' && block.name === 'response_formatter'
    );
    
    if (!toolUseBlock) {
      throw new Error('Expected response_formatter tool use in Anthropic response');
    }
    
    // Get formatter output from tool input
    const formatterOutput = toolUseBlock.input;
    
    // Validate basic structure
    if (!formatterOutput.conversation || !Array.isArray(formatterOutput.conversation)) {
      throw new Error('Invalid formatter output structure: missing conversation array');
    }
    
    return formatterOutput;
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