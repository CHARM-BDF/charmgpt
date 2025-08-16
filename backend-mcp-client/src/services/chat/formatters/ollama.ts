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
   * Extract formatter output from Ollama response
   */
  extractFormatterOutput(response: any): FormatterOutput {
    console.log('🟤 [OLLAMA-FORMATTER] Extracting formatter output from Ollama response');
    
    // Log the response structure for debugging
    console.log('🟤 [OLLAMA-FORMATTER] Response structure:', JSON.stringify({
      hasMessage: !!response?.message,
      hasToolCalls: !!(response?.message?.tool_calls && response.message.tool_calls.length > 0),
      toolCallsCount: response?.message?.tool_calls?.length || 0,
      hasContent: !!response?.message?.content,
      contentLength: response?.message?.content?.length || 0,
      contentPreview: response?.message?.content?.substring(0, 100) || ''
    }));

    // First try to extract from tool_calls if present
    if (response?.message?.tool_calls && response.message.tool_calls.length > 0) {
      console.log('🟤 [OLLAMA-FORMATTER] Found tool_calls in response');
      
      // Find ANY tool call (Ollama might use different names)
      const toolCall = response.message.tool_calls[0]; // Take the first tool call
      
      if (toolCall && toolCall.function?.arguments) {
        console.log('🟤 [OLLAMA-FORMATTER] Found tool call:', toolCall.function.name);
        console.log('🟤 [OLLAMA-FORMATTER] Tool call arguments:', JSON.stringify(toolCall.function.arguments));
        
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
          
          // Check if this looks like formatter output
          if (formatterOutput.conversation || formatterOutput.thinking) {
            console.log('🟤 [OLLAMA-FORMATTER] Tool call contains formatter-like structure');
            return this.validateFormatterOutput(formatterOutput);
          }
          
          // If it's not formatter output, try to convert it to formatter output
          console.log('🟤 [OLLAMA-FORMATTER] Converting non-formatter tool call to formatter output');
          
          // Handle common patterns from Ollama
          let content = '';
          if (formatterOutput.value) {
            content = formatterOutput.value;
          } else if (formatterOutput.text) {
            content = formatterOutput.text;
          } else if (formatterOutput.content) {
            content = formatterOutput.content;
          } else {
            // Use the entire arguments as content
            content = JSON.stringify(formatterOutput, null, 2);
          }
          
          const convertedOutput = {
            thinking: `Ollama used tool: ${toolCall.function.name}`,
            conversation: [{
              type: 'text',
              content: content
            }]
          };
          
          console.log('🟤 [OLLAMA-FORMATTER] Successfully converted tool call to formatter output');
          return this.validateFormatterOutput(convertedOutput);
          
        } catch (error) {
          console.error('🟤 [OLLAMA-FORMATTER] Error parsing tool call arguments:', error);
          // Fall through to content extraction
        }
      }
    }
    
    // CRITICAL FIX: If we don't have valid tool call output, try to extract from content
    // This handles the case where Ollama returns text that looks like tool call JSON
    console.log('🟤 [OLLAMA-FORMATTER] Trying to extract from content');
    
    const content = response?.message?.content || response?.content || '';
    
    if (content) {
      console.log('🟤 [OLLAMA-FORMATTER] Content found, length:', content.length);
      console.log('🟤 [OLLAMA-FORMATTER] Content preview:', content.substring(0, 200));
      
      // NEW: Check if content looks like a tool call response
      // Pattern: {"name": "response_formatter", "parameters": {...}}
      try {
        // Try to parse the entire content as JSON first
        const parsedContent = JSON.parse(content);
        
        // Check if it has the tool call structure
        if (parsedContent.name === 'response_formatter' && parsedContent.parameters) {
          console.log('🟤 [OLLAMA-FORMATTER] Found tool call structure in content!');
          return this.validateFormatterOutput(parsedContent.parameters);
        }
        
        // Check if it's already in the expected format
        if (parsedContent.conversation || parsedContent.thinking) {
          console.log('🟤 [OLLAMA-FORMATTER] Found direct formatter output in content!');
          return this.validateFormatterOutput(parsedContent);
        }
      } catch (parseError) {
        console.log('🟤 [OLLAMA-FORMATTER] Content is not valid JSON, trying regex extraction');
      }
      
      // NEW: Try to extract JSON from text using regex patterns
      // Look for {"name": "response_formatter", "parameters": {...}}
      const toolCallPattern = /\{"name":\s*"response_formatter",\s*"parameters":\s*(\{.*?\})\}/s;
      const toolCallMatch = content.match(toolCallPattern);
      
      if (toolCallMatch) {
        console.log('🟤 [OLLAMA-FORMATTER] Found tool call pattern in content!');
        try {
          const parameters = JSON.parse(toolCallMatch[1]);
          return this.validateFormatterOutput(parameters);
        } catch (error) {
          console.error('🟤 [OLLAMA-FORMATTER] Error parsing extracted tool call parameters:', error);
        }
      }
      
      // NEW: Look for direct JSON objects that might be formatter output
      const jsonPattern = /\{[\s\S]*"conversation"[\s\S]*\}/;
      const jsonMatch = content.match(jsonPattern);
      
      if (jsonMatch) {
        console.log('🟤 [OLLAMA-FORMATTER] Found JSON pattern with conversation in content!');
        try {
          const formatterOutput = JSON.parse(jsonMatch[0]);
          return this.validateFormatterOutput(formatterOutput);
        } catch (error) {
          console.error('🟤 [OLLAMA-FORMATTER] Error parsing extracted JSON:', error);
        }
      }
      
      // Fallback: Create a simple formatter output from the content
      console.log('🟤 [OLLAMA-FORMATTER] Creating fallback formatter output from content');
      return {
        thinking: "Ollama returned text instead of tool call - converted to formatter output",
        conversation: [{
          type: 'text',
          content: content
        }]
      };
    }
    
    // If we get here, we have no usable content
    console.error('🟤 [OLLAMA-FORMATTER] No tool calls or content found in response');
    throw new Error('No formatter output found in Ollama response - no tool calls or content available');
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
        ? formatterOutput.conversation.length : 0,
      conversationType: typeof formatterOutput.conversation
    }));
    
    // Log the raw conversation value for debugging
    if (formatterOutput.conversation) {
      console.log('🟤 [OLLAMA-FORMATTER] Raw conversation value:', 
        typeof formatterOutput.conversation === 'string' 
          ? formatterOutput.conversation.substring(0, 200) + '...'
          : JSON.stringify(formatterOutput.conversation).substring(0, 200) + '...');
    }
    
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
      console.log('🟤 [OLLAMA-FORMATTER] Conversation is a string, attempting to parse as JSON');
      
      try {
        // Clean up the string first - remove any surrounding quotes and handle escaped quotes
        let cleanConversation = formatterOutput.conversation.trim();
        
        // Remove surrounding quotes if present
        if (cleanConversation.startsWith('"') && cleanConversation.endsWith('"')) {
          cleanConversation = cleanConversation.slice(1, -1);
        }
        
        // Replace escaped quotes
        cleanConversation = cleanConversation.replace(/\\"/g, '"');
        
        // Replace unicode escapes
        cleanConversation = cleanConversation.replace(/\\u([0-9a-fA-F]{4})/g, (match: string, code: string) => {
          return String.fromCharCode(parseInt(code, 16));
        });
        
        // Replace weird quote characters with normal quotes
        cleanConversation = cleanConversation.replace(/«/g, '"').replace(/»/g, '"');
        
        console.log('🟤 [OLLAMA-FORMATTER] Cleaned conversation string:', cleanConversation.substring(0, 200) + '...');
        
        const parsedConversation = JSON.parse(cleanConversation);
        
        if (Array.isArray(parsedConversation)) {
          console.log('🟤 [OLLAMA-FORMATTER] Successfully parsed string conversation into array');
          formatterOutput.conversation = parsedConversation;
        } else {
          console.warn('🟤 [OLLAMA-FORMATTER] Parsed conversation is not an array - converting to array');
          // Convert to array with single text item
          formatterOutput.conversation = [{
            type: 'text',
            content: cleanConversation
          }];
        }
      } catch (error) {
        // If parsing fails, treat as plain text
        console.error('🟤 [OLLAMA-FORMATTER] Failed to parse conversation string as JSON:', error);
        console.log('🟤 [OLLAMA-FORMATTER] Original string that failed to parse:', formatterOutput.conversation);
        
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
    
    // Final validation of the conversation array
    if (Array.isArray(formatterOutput.conversation)) {
      console.log('🟤 [OLLAMA-FORMATTER] Final conversation array has', formatterOutput.conversation.length, 'items');
      formatterOutput.conversation.forEach((item: any, index: number) => {
        console.log(`🟤 [OLLAMA-FORMATTER] Item ${index + 1}: type=${item.type}, hasContent=${!!item.content}, hasArtifact=${!!item.artifact}`);
      });
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