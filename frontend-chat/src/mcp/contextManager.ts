import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { z } from 'zod';
import { 
  MCPToolContext, 
  MCPPrompt, 
  MCPResource, 
  MCPContext,
  MCPToolSchema,
  MCPTool,
  MCPToolResponse,
  MCPPromptResponse,
  MCPResourceResponse,
  MCPResourceTemplate
} from './types';

export class MCPContextManager {
  private client: Client;
  private context: MCPContext | null = null;
  private lastUpdate: number | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  constructor(client: Client) {
    this.client = client;
  }

  async prepareLLMContext(): Promise<MCPContext> {
    try {
      // Check if we need to refresh the cache
      if (!this.shouldRefreshCache()) {
        console.debug('Using cached context');
        return this.context!;
      }

      console.info('Refreshing LLM context from MCP capabilities');

      const tools = await this.safeListTools();
      const prompts = await this.safeListPrompts();
      const resources = await this.safeListResources();

      this.context = {
        available_tools: tools.tools
          .filter((tool): tool is MCPTool => this.isValidTool(tool))
          .map(tool => this.convertToToolContext(tool)),
        available_prompts: prompts.prompts
          .filter((prompt): prompt is MCPPrompt => this.isValidPrompt(prompt))
          .map(prompt => ({
            name: prompt.name,
            description: prompt.description || '',
            arguments: prompt.arguments || []
          })),
        available_resources: resources.resources
          .filter((resource): resource is MCPResource => this.isValidResource(resource))
          .map(resource => ({
            name: resource.name,
            uri: resource.uri,
            description: resource.description || ''
          }))
      };

      this.lastUpdate = Date.now();
      console.info('Successfully updated LLM context');
      return this.context;
    } catch (error) {
      console.error('Unexpected error preparing LLM context:', error);
      // Return empty context on error
      return {
        available_tools: [],
        available_prompts: [],
        available_resources: []
      };
    }
  }

  private shouldRefreshCache(): boolean {
    if (!this.context || !this.lastUpdate) {
      return true;
    }
    return Date.now() - this.lastUpdate > this.CACHE_TTL;
  }

  private async safeListTools(): Promise<MCPToolResponse> {
    try {
      const response = await this.client.listTools();
      console.debug(`Retrieved ${response.tools.length} tools`);
      
      // Convert response to expected type
      const tools: MCPTool[] = response.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as MCPToolSchema
      }));
      
      return { tools };
    } catch (error) {
      console.error('Failed to list tools:', error);
      return { tools: [] };
    }
  }

  private async safeListPrompts(): Promise<MCPPromptResponse> {
    try {
      const response = await this.client.listPrompts();
      console.debug(`Retrieved ${response.prompts.length} prompts`);
      
      // Convert response to expected type
      const prompts: MCPPrompt[] = response.prompts.map(prompt => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments
      }));
      
      return { prompts };
    } catch (error) {
      console.error('Failed to list prompts:', error);
      return { prompts: [] };
    }
  }

  private async safeListResources(): Promise<MCPResourceResponse> {
    try {
      const response = await this.client.listResources();
      console.debug(`Retrieved ${response.resources.length} resources`);
      
      // Convert response to expected type
      const resources: MCPResource[] = response.resources.map(resource => ({
        name: resource.name,
        uri: resource.uri,
        description: resource.description
      }));
      
      const resourceTemplates: MCPResourceTemplate[] = (Array.isArray(response.resourceTemplates) ? response.resourceTemplates : []).map((template: Partial<MCPResourceTemplate>) => ({
        uriTemplate: template.uriTemplate || '',
        name: template.name || '',
        description: template.description
      }));
      
      return { 
        resources,
        resourceTemplates
      };
    } catch (error) {
      console.error('Failed to list resources:', error);
      return { resources: [], resourceTemplates: [] };
    }
  }

  private convertToToolContext(tool: MCPTool): MCPToolContext {
    return {
      name: tool.name,
      description: tool.description || '',
      parameters: this.validateSchema(tool.name, tool.inputSchema),
      example: this.generateToolExample(tool)
    };
  }

  private validateSchema(toolName: string, schema: MCPToolSchema): Record<string, any> {
    try {
      const zodSchema = this.createZodSchema(schema);
      if (zodSchema instanceof z.ZodObject) {
        return zodSchema.shape;
      }
      return {};
    } catch (error) {
      console.warn(`Invalid schema for tool ${toolName}:`, error);
      return {};
    }
  }

  private createZodSchema(schema: MCPToolSchema): z.ZodTypeAny {
    const type = schema.type;

    if (type === 'string') {
      return z.string();
    } else if (type === 'number') {
      return z.number();
    } else if (type === 'integer') {
      return z.number().int();
    } else if (type === 'boolean') {
      return z.boolean();
    } else if (type === 'array' && schema.items) {
      return z.array(this.createZodSchema(schema.items));
    } else if (type === 'object' && schema.properties) {
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        shape[key] = this.createZodSchema(value);
      }
      return z.object(shape);
    }
    return z.any();
  }

  private generateToolExample(tool: MCPTool): Record<string, any> | null {
    if (!tool.inputSchema || !tool.inputSchema.properties) {
      return null;
    }

    const exampleArgs: Record<string, any> = {};
    for (const [propName, prop] of Object.entries(tool.inputSchema.properties)) {
      if (prop.type === 'string') {
        exampleArgs[propName] = 'example_string';
      } else if (prop.type === 'number' || prop.type === 'integer') {
        exampleArgs[propName] = 42;
      } else if (prop.type === 'boolean') {
        exampleArgs[propName] = true;
      }
    }

    return {
      name: tool.name,
      arguments: exampleArgs
    };
  }

  private isValidTool(tool: MCPTool): boolean {
    return Boolean(tool.name && tool.inputSchema);
  }

  private isValidPrompt(prompt: MCPPrompt): boolean {
    return Boolean(prompt.name);
  }

  private isValidResource(resource: MCPResource): boolean {
    return Boolean(resource.name && resource.uri);
  }

  asSystemPrompt(): string {
    if (!this.context) {
      return '';
    }

    const parts = ['You have access to the following capabilities:'];

    if (this.context.available_tools.length > 0) {
      parts.push('\nTOOLS:');
      for (const tool of this.context.available_tools) {
        parts.push(`- ${tool.name}: ${tool.description}`);
        if (tool.example) {
          parts.push(`  Example: ${JSON.stringify(tool.example)}`);
        }
      }
    }

    if (this.context.available_prompts.length > 0) {
      parts.push('\nPROMPTS:');
      for (const prompt of this.context.available_prompts) {
        parts.push(`- ${prompt.name}: ${prompt.description}`);
        if (prompt.arguments && prompt.arguments.length > 0) {
          parts.push('  Arguments:');
          for (const arg of prompt.arguments) {
            parts.push(`    - ${arg.name}: ${arg.description} (${arg.required ? 'required' : 'optional'})`);
          }
        }
      }
    }

    if (this.context.available_resources.length > 0) {
      parts.push('\nRESOURCES:');
      for (const resource of this.context.available_resources) {
        parts.push(`- ${resource.name}: ${resource.description}`);
      }
    }

    return parts.join('\n');
  }

  formatForClaude(): Record<string, any> {
    if (!this.context) {
      return {};
    }

    return {
      tools: this.context.available_tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }))
    };
  }

  getContext(): MCPContext | null {
    return this.context;
  }
} 