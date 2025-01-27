import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { ServerConfig, ResourceInfo, ToolInfo, PromptInfo } from '../store/mcpStore';

export class MCPService {
    private clients: Map<string, Client> = new Map();
    private transports: Map<string, StdioClientTransport | SSEClientTransport> = new Map();

    async installServer(config: ServerConfig): Promise<string> {
        const client = new Client(
            {
                name: config.name,
                version: '1.0.0',
            },
            {
                capabilities: {
                    prompts: {},
                    resources: {},
                    tools: {},
                },
            }
        );

        // Create appropriate transport based on configuration
        const transport = config.transport === 'stdio'
            ? new StdioClientTransport({
                command: config.command!,
                args: config.args || [],
            })
            : new SSEClientTransport(new URL(config.url!));

        try {
            await client.connect(transport);
            const id = `mcp-${Date.now()}`;
            this.clients.set(id, client);
            this.transports.set(id, transport);
            return id;
        } catch (error) {
            console.error('Failed to install MCP server:', error);
            throw new Error('Failed to install MCP server');
        }
    }

    async startServer(serverId: string): Promise<void> {
        const client = this.clients.get(serverId);
        const transport = this.transports.get(serverId);
        if (!client || !transport) {
            throw new Error('Server not found');
        }

        try {
            // Reconnect using the stored transport
            await client.connect(transport);
        } catch (error) {
            console.error('Failed to start MCP server:', error);
            throw new Error('Failed to start MCP server');
        }
    }

    async stopServer(serverId: string): Promise<void> {
        const transport = this.transports.get(serverId);
        if (!transport) {
            throw new Error('Server not found');
        }

        try {
            // Close the transport connection
            if (transport instanceof StdioClientTransport) {
                await transport.close();
            } else if (transport instanceof SSEClientTransport) {
                await transport.close();
            }
            this.transports.delete(serverId);
        } catch (error) {
            console.error('Failed to stop MCP server:', error);
            throw new Error('Failed to stop MCP server');
        }
    }

    async listResources(serverId: string): Promise<ResourceInfo[]> {
        const client = this.clients.get(serverId);
        if (!client) {
            throw new Error('Server not found');
        }

        try {
            const response = await client.listResources();
            // First convert to unknown, then to our expected type
            const resources = (response as unknown) as Array<{
                name: string;
                uri: string;
                description?: string;
            }>;
            
            return resources.map(resource => ({
                name: resource.name,
                uri: resource.uri,
                description: resource.description,
            }));
        } catch (error) {
            console.error('Failed to list resources:', error);
            throw new Error('Failed to list resources');
        }
    }

    async listTools(serverId: string): Promise<ToolInfo[]> {
        const client = this.clients.get(serverId);
        if (!client) {
            throw new Error('Server not found');
        }

        try {
            const response = await client.listTools();
            // First convert to unknown, then to our expected type
            const tools = (response as unknown) as Array<{
                name: string;
                description?: string;
                parameters: Record<string, any>;
            }>;

            return tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            }));
        } catch (error) {
            console.error('Failed to list tools:', error);
            throw new Error('Failed to list tools');
        }
    }

    async listPrompts(serverId: string): Promise<PromptInfo[]> {
        const client = this.clients.get(serverId);
        if (!client) {
            throw new Error('Server not found');
        }

        try {
            const response = await client.listPrompts();
            // First convert to unknown, then to our expected type
            const prompts = (response as unknown) as Array<{
                name: string;
                description?: string;
                parameters: Record<string, any>;
            }>;

            return prompts.map(prompt => ({
                name: prompt.name,
                description: prompt.description,
                parameters: prompt.parameters,
            }));
        } catch (error) {
            console.error('Failed to list prompts:', error);
            throw new Error('Failed to list prompts');
        }
    }

    async executeToolCall(serverId: string, toolName: string, args: Record<string, unknown>): Promise<any> {
        const client = this.clients.get(serverId);
        if (!client) {
            throw new Error('Server not found');
        }

        try {
            return await client.callTool({
                name: toolName,
                arguments: args,
            });
        } catch (error) {
            console.error('Failed to execute tool:', error);
            throw new Error('Failed to execute tool');
        }
    }

    async fetchResource(serverId: string, resourceUri: string): Promise<any> {
        const client = this.clients.get(serverId);
        if (!client) {
            throw new Error('Server not found');
        }

        try {
            return await client.readResource({
                uri: resourceUri,
            });
        } catch (error) {
            console.error('Failed to fetch resource:', error);
            throw new Error('Failed to fetch resource');
        }
    }

    async executePrompt(serverId: string, promptName: string, args: Record<string, string>): Promise<any> {
        const client = this.clients.get(serverId);
        if (!client) {
            throw new Error('Server not found');
        }

        try {
            return await client.getPrompt({
                name: promptName,
                arguments: args,
            });
        } catch (error) {
            console.error('Failed to execute prompt:', error);
            throw new Error('Failed to execute prompt');
        }
    }
} 