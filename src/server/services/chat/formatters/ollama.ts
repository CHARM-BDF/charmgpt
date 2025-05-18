/**
 * Ollama Response Formatter Adapter
 * 
 * This file implements the response formatter adapter for Ollama.
 * It handles Ollama's unique response format and converts it to 
 * the standardized store format.
 */

import { ResponseFormatterAdapter, FormatterOutput } from './types';
import { StoreFormat } from '../../message';
import crypto from 'crypto';

/**
 * Response formatter adapter for Ollama
 */
export class OllamaResponseFormatterAdapter implements ResponseFormatterAdapter {
  /**
   * Get the Ollama-specific tool definition for response formatter
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
   * Extract formatter output from Ollama's response
   * 
   * Ollama may not properly use the tool call format, so this method
   * handles both tool call responses and direct text responses.
   */
  extractFormatterOutput(response: any): FormatterOutput {
    console.log('🟤 [OLLAMA-FORMATTER] Extracting formatter output from Ollama response');

    // Log the response structure for debugging
    console.log('🟤 [OLLAMA-FORMATTER] Response structure:', JSON.stringify({
      type: typeof response,
      hasMessage: !!response?.message,
      hasToolCalls: !!response?.message?.tool_calls,
      hasContent: !!response?.message?.content,
      messageType: typeof response?.message,
      contentType: typeof response?.message?.content,
      contentLength: response?.message?.content?.length || 0
    }));

    // First try to extract from tool_calls if present
    if (response?.message?.tool_calls && response.message.tool_calls.length > 0) {
      console.log('🟤 [OLLAMA-FORMATTER] Found tool_calls in response');
      
      // Find the response_formatter tool call
      const toolCall = response.message.tool_calls.find((tc: any) => 
        tc.function?.name === 'response_formatter'
      );
      
      if (toolCall && toolCall.function?.arguments) {
        console.log('🟤 [OLLAMA-FORMATTER] Found response_formatter tool call');
        try {
          // Parse the arguments
          let formatterOutput;
          
          if (typeof toolCall.function.arguments === 'string') {
            // Parse JSON string
            formatterOutput = JSON.parse(toolCall.function.arguments);
          } else {
            // Already an object
            formatterOutput = toolCall.function.arguments;
          }
          
          console.log('🟤 [OLLAMA-FORMATTER] Parsed formatter output');
          
          // Validate and return
          return this.validateFormatterOutput(formatterOutput);
        } catch (error) {
          console.error('🟤 [OLLAMA-FORMATTER] Error parsing tool call arguments:', error);
          // Fall through to content extraction
        }
      }
    }
    
    // If we don't have valid tool call output, try to extract from content
    console.log('🟤 [OLLAMA-FORMATTER] Trying to extract from content');
    
    const content = response?.message?.content || response?.content || '';
    if (typeof content === 'string' && content.length > 0) {
      console.log('🟤 [OLLAMA-FORMATTER] Extracting from content string');
      
      // Try to find JSON in the content
      const jsonMatch = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/) || 
                        content.match(/{[\s\S]*"conversation"[\s\S]*?}/);
      
      if (jsonMatch) {
        try {
          // Parse the JSON found in content
          const formatterOutput = JSON.parse(jsonMatch[1]);
          console.log('🟤 [OLLAMA-FORMATTER] Found and parsed JSON in content');
          return this.validateFormatterOutput(formatterOutput);
        } catch (error) {
          console.error('🟤 [OLLAMA-FORMATTER] Error parsing JSON in content:', error);
        }
      }
      
      // If no JSON or parsing failed, create a text-only response
      console.log('🟤 [OLLAMA-FORMATTER] Creating text-only formatter output');
      return {
        thinking: "",
        conversation: [{
          type: 'text',
          content: content
        }]
      };
    }
    
    // Last resort fallback
    console.warn('🟤 [OLLAMA-FORMATTER] No valid content found, returning fallback response');
    return {
      thinking: "",
      conversation: [{
        type: 'text',
        content: "The model didn't provide a properly structured response."
      }]
    };
  }
  
  /**
   * Validate and normalize formatter output
   */
  private validateFormatterOutput(formatterOutput: any): FormatterOutput {
    // Log the structure
    console.log('🟤 [OLLAMA-FORMATTER] Validating formatter output:', JSON.stringify({
      hasThinking: !!formatterOutput.thinking,
      hasConversation: !!formatterOutput.conversation,
      isConversationArray: Array.isArray(formatterOutput.conversation),
      conversationLength: Array.isArray(formatterOutput.conversation) 
        ? formatterOutput.conversation.length : 0
    }));
    
    // Ensure conversation is an array
    if (!formatterOutput.conversation) {
      console.warn('🟤 [OLLAMA-FORMATTER] Missing conversation array - creating fallback');
      formatterOutput.conversation = [{
        type: 'text',
        content: formatterOutput.content || formatterOutput.text || 
          "The model didn't provide a properly structured response"
      }];
    }
    
    // If conversation is a string, try to parse it as JSON
    if (typeof formatterOutput.conversation === 'string') {
      try {
        const parsedConversation = JSON.parse(formatterOutput.conversation);
        if (Array.isArray(parsedConversation)) {
          formatterOutput.conversation = parsedConversation;
          console.log('🟤 [OLLAMA-FORMATTER] Parsed string conversation into array');
        } else {
          // Convert to array with single text item
          formatterOutput.conversation = [{
            type: 'text',
            content: formatterOutput.conversation
          }];
        }
      } catch (error) {
        // If parsing fails, treat as plain text
        console.warn('🟤 [OLLAMA-FORMATTER] Failed to parse conversation string as JSON');
        formatterOutput.conversation = [{
          type: 'text',
          content: formatterOutput.conversation
        }];
      }
    } 
    else if (!Array.isArray(formatterOutput.conversation)) {
      // Convert object to array
      console.warn('🟤 [OLLAMA-FORMATTER] Conversation is not an array - converting');
      formatterOutput.conversation = [formatterOutput.conversation];
    }
    
    return formatterOutput;
  }

  /**
   * Convert formatter output to store format
   */
  convertToStoreFormat(formatterOutput: FormatterOutput): StoreFormat {
    console.log('🟤 [OLLAMA-FORMATTER] Converting formatter output to store format');
    
    // Process conversation items into the expected format
    const conversation: string[] = [];
    const artifacts: Array<any> = [];
    let position = 0;
    
    // Process conversation items
    if (formatterOutput.conversation && Array.isArray(formatterOutput.conversation)) {
      console.log(`🟤 [OLLAMA-FORMATTER] Processing ${formatterOutput.conversation.length} conversation items`);
      
      formatterOutput.conversation.forEach(item => {
        if (item.type === 'text' && item.content) {
          // Add text content to conversation array as string
          conversation.push(item.content);
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
          
          // Add artifact button reference to conversation text array
          conversation.push(this.createArtifactButton(uniqueId, item.artifact.type, item.artifact.title));
        }
      });
    }
    
    console.log(`🟤 [OLLAMA-FORMATTER] Processed ${conversation.length} conversation items and ${artifacts.length} artifacts`);
    
    // Join conversation text segments with double newlines
    return {
      thinking: formatterOutput.thinking || "",
      conversation: conversation.join('\n\n'),  // Join text segments into a single string
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