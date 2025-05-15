/**
 * Gemini Response Formatter Adapter
 * 
 * This file implements the response formatter adapter for Google's Gemini.
 * Updated to support both Gemini 1.5 and 2.0 response formats.
 */

import { ResponseFormatterAdapter, FormatterOutput } from './types';
import { StoreFormat } from '../../message';
import crypto from 'crypto';

/**
 * Response formatter adapter for Google's Gemini
 */
export class GeminiResponseFormatterAdapter implements ResponseFormatterAdapter {
  /**
   * Get the Gemini-specific tool definition for response formatter
   */
  getResponseFormatterToolDefinition(): any {
    console.log('\n=== GEMINI FORMATTER TOOL DEFINITION ===');
    const toolDefinition = {
      functionDeclarations: [{
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
      }]
    };
    console.log('Tool definition:', JSON.stringify(toolDefinition, null, 2));
    console.log('=== END GEMINI FORMATTER TOOL DEFINITION ===\n');
    return toolDefinition;
  }
  
  /**
   * Extract formatter output from Gemini response
   */
  extractFormatterOutput(response: any): FormatterOutput {
    console.log('\n=== GEMINI FORMATTER OUTPUT EXTRACTION ===');
    console.log('Raw response:', JSON.stringify(response, null, 2));
    
    try {
      let formatterCall = null;
      
      // First try the Gemini 2.0 structure
      if (response && 
          response.candidates && 
          Array.isArray(response.candidates) && 
          response.candidates.length > 0 &&
          response.candidates[0].content &&
          response.candidates[0].content.parts) {
          
        // Find the response_formatter function call in parts
        const parts = response.candidates[0].content.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (part.functionCall && part.functionCall.name === 'response_formatter') {
              formatterCall = part.functionCall;
              console.log('Formatter call from Gemini 2.0 structure:', JSON.stringify(formatterCall, null, 2));
              break;
            }
          }
        }
      }

      // If we didn't find a formatter call in Gemini 2.0 structure, try the older method
      if (!formatterCall) {
        // Check for function calls in the old structure
        if (response.functionCalls && Array.isArray(response.functionCalls)) {
          formatterCall = response.functionCalls.find((call: any) => call.name === 'response_formatter');
          if (formatterCall) {
            console.log('Formatter call from direct property:', JSON.stringify(formatterCall, null, 2));
          }
        } else {
          console.log('No function calls found in response');
          throw new Error('No function calls found in Gemini response');
        }
      }
      
      if (!formatterCall) {
        console.log('No response_formatter call found');
        throw new Error('Expected response_formatter function call in Gemini response');
      }
      
      // Get arguments from the function call
      const formatterOutput = formatterCall.args;
      console.log('Formatter output:', JSON.stringify(formatterOutput, null, 2));
      
      // Validate basic structure
      if (!formatterOutput.conversation || !Array.isArray(formatterOutput.conversation)) {
        console.log('Invalid formatter output structure');
        throw new Error('Invalid formatter output structure: missing conversation array');
      }
      
      console.log('=== END GEMINI FORMATTER OUTPUT EXTRACTION ===\n');
      return formatterOutput;
    } catch (error) {
      console.error('Error extracting Gemini formatter output:', error);
      console.log('=== END GEMINI FORMATTER OUTPUT EXTRACTION ===\n');
      throw new Error(`Failed to extract Gemini formatter output: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Convert formatter output to store format
   */
  convertToStoreFormat(formatterOutput: FormatterOutput): StoreFormat {
    console.log('\n=== GEMINI FORMATTER STORE CONVERSION ===');
    console.log('Input formatter output:', JSON.stringify(formatterOutput, null, 2));
    
    const conversation: string[] = [];
    const artifacts: Array<any> = [];
    let position = 0;
    
    // Process conversation items
    if (formatterOutput.conversation && Array.isArray(formatterOutput.conversation)) {
      formatterOutput.conversation.forEach((item, index) => {
        console.log(`Processing conversation item ${index}:`, JSON.stringify(item, null, 2));
        
        if (item.type === 'text' && item.content) {
          // Add text content to conversation
          conversation.push(item.content);
          console.log('Added text content to conversation');
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
          const button = this.createArtifactButton(uniqueId, item.artifact.type, item.artifact.title);
          conversation.push(button);
          console.log('Added artifact to conversation:', JSON.stringify({
            id: uniqueId,
            type: item.artifact.type,
            title: item.artifact.title
          }, null, 2));
        }
      });
    }
    
    const storeFormat = {
      thinking: formatterOutput.thinking,
      conversation: conversation.join('\n\n'),
      artifacts: artifacts.length > 0 ? artifacts : undefined
    };
    
    console.log('Final store format:', JSON.stringify(storeFormat, null, 2));
    console.log('=== END GEMINI FORMATTER STORE CONVERSION ===\n');
    
    return storeFormat;
  }
  
  /**
   * Create HTML button for artifact
   */
  private createArtifactButton(id: string, type: string, title: string): string {
    const button = `<button class="artifact-button text-sm text-blue-600 dark:text-blue-400 hover:underline" data-artifact-id="${id}" data-artifact-type="${type}" style="cursor: pointer; background: none; border: none; padding: 0;">📎 ${title}</button>`;
    console.log('Created artifact button:', button);
    return button;
  }
} 