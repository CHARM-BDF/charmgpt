/**
 * Ollama client wrapper implementation
 */

import { Ollama } from 'ollama';
import { OllamaConfig, Message, Tool, ToolResponse, ServerResponse } from './ollamaTypes';
import { validateArtifactType } from '../ollamaUtils';
import crypto from 'crypto';

export class OllamaWrapper {
  private client: Ollama;
  private model: string;
  
  constructor(config: OllamaConfig) {
    this.client = new Ollama({
      host: config.host
    });
    this.model = process.env.OLLAMA_MODEL || 'mistral';
  }

  /**
   * Process a message through Ollama
   * Handles both tool execution and response formatting
   */
  async processMessage(message: string, history: Message[], mcpTools: any[]): Promise<ServerResponse> {
    try {
      // Convert MCP tools to Ollama format
      const tools: Tool[] = mcpTools.map(mcpTool => {
        // Convert properties to Ollama's expected format
        const properties: { [key: string]: { type: string; description: string; enum?: string[] } } = {};
        
        if (mcpTool.inputSchema?.properties) {
          Object.entries(mcpTool.inputSchema.properties).forEach(([key, value]: [string, any]) => {
            properties[key] = {
              type: value.type || 'string',
              description: value.description || `Parameter ${key}`,
              ...(value.enum ? { enum: value.enum } : {})
            };
          });
        }

        return {
          type: 'function',
          function: {
            name: mcpTool.name,
            description: mcpTool.description || `Tool for ${mcpTool.name}`,
            parameters: {
              type: "object",
              properties,
              required: Array.isArray(mcpTool.inputSchema?.required) ? mcpTool.inputSchema.required : []
            }
          }
        };
      });

      // Phase 1: Tool Execution
      const toolResult = await this.handleTools(message, history, tools);
      
      // Phase 2: Response Formatting
      return this.formatResponse(toolResult);
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unknown error in processMessage');
    }
  }

  /**
   * Handle tool execution phase
   */
  private async handleTools(message: string, history: Message[], tools: Tool[]): Promise<any> {
    const response = await this.client.chat({
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that can use tools when needed.' },
        ...history,
        { role: 'user', content: message }
      ],
      tools: tools,
      format: 'json'
    });

    return response;
  }

  /**
   * Format the response into the expected structure
   */
  private formatResponse(toolResult: any): ServerResponse {
    const artifacts: Array<{
      id: string;
      type: string;
      title: string;
      content: string;
      position: number;
      language?: string;
    }> = [];

    let position = 0;
    const conversation: string[] = [];

    // Process tool result and format response
    // This is a placeholder - we'll implement the full logic next
    if (toolResult.message?.content) {
      conversation.push(toolResult.message.content);
    }

    return {
      response: {
        conversation: conversation.join('\n\n'),
        artifacts: artifacts.length > 0 ? artifacts : undefined
      }
    };
  }
} 