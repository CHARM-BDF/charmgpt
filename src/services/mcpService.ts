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
            // Connect and detect capabilities
            await client.connect(transport);
            const id = `mcp-${Date.now()}`;
            
            // Store client and transport
            this.clients.set(id, client);
            this.transports.set(id, transport);

            return id;
        } catch (error) {
            console.error('Failed to install MCP server:', error);
            throw new Error('Failed to install MCP server');
        }
    }

    async detectCapabilities(serverId: string): Promise<{
        resources: boolean;
        tools: boolean;
        prompts: boolean;
    }> {
        const client = this.clients.get(serverId);
        if (!client) {
            throw new Error('Server not found');
        }

        try {
            const capabilities = {
                resources: false,
                tools: false,
                prompts: false
            };

            // Test each capability
            try {
                const response = await client.listResources();
                // Type check and validate response
                const resources = (response as unknown) as Array<{
                    name: string;
                    uri: string;
                    description?: string;
                }>;
                // Consider it supported if we can get a valid response, even if empty
                capabilities.resources = Array.isArray(resources);
                console.log(`Resources capability detected: ${resources.length} resources available`);
            } catch (e) {
                console.log('Resources not supported:', e instanceof Error ? e.message : 'Unknown error');
            }

            try {
                const response = await client.listTools();
                // Type check and validate response
                const tools = (response as unknown) as Array<{
                    name: string;
                    description?: string;
                    parameters: Record<string, any>;
                }>;
                // Consider it supported if we can get a valid response, even if empty
                capabilities.tools = Array.isArray(tools);
                console.log(`Tools capability detected: ${tools.length} tools available`);
            } catch (e) {
                console.log('Tools not supported:', e instanceof Error ? e.message : 'Unknown error');
            }

            try {
                const response = await client.listPrompts();
                // Type check and validate response
                const prompts = (response as unknown) as Array<{
                    name: string;
                    description?: string;
                    parameters: Record<string, any>;
                }>;
                // Consider it supported if we can get a valid response, even if empty
                capabilities.prompts = Array.isArray(prompts);
                console.log(`Prompts capability detected: ${prompts.length} prompts available`);
            } catch (e) {
                console.log('Prompts not supported:', e instanceof Error ? e.message : 'Unknown error');
            }

            return capabilities;
        } catch (error) {
            console.error('Failed to detect capabilities:', error);
            throw new Error('Failed to detect server capabilities');
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
            
            // Detect capabilities after successful connection
            const capabilities = await this.detectCapabilities(serverId);
            
            // If any capability is available, start fetching available resources/tools/prompts
            if (capabilities.resources || capabilities.tools || capabilities.prompts) {
                await this.refreshServerResponses(serverId, capabilities);
            }
        } catch (error) {
            console.error('Failed to start MCP server:', error);
            throw new Error('Failed to start MCP server');
        }
    }

    async refreshServerResponses(
        serverId: string, 
        capabilities: { resources: boolean; tools: boolean; prompts: boolean }
    ): Promise<{
        resources: ResourceInfo[];
        tools: ToolInfo[];
        prompts: PromptInfo[];
    }> {
        const client = this.clients.get(serverId);
        if (!client) {
            throw new Error('Server not found');
        }

        const responses = {
            resources: [] as ResourceInfo[],
            tools: [] as ToolInfo[],
            prompts: [] as PromptInfo[],
        };

        try {
            // Fetch all available resources, tools, and prompts based on capabilities
            if (capabilities.resources) {
                const response = await client.listResources();
                const resources = (response as unknown) as Array<{
                    name: string;
                    uri: string;
                    description?: string;
                }>;
                responses.resources = resources.map(resource => ({
                    name: resource.name,
                    uri: resource.uri,
                    description: resource.description,
                }));
            }

            if (capabilities.tools) {
                const response = await client.listTools();
                const tools = (response as unknown) as Array<{
                    name: string;
                    description?: string;
                    parameters: Record<string, any>;
                }>;
                responses.tools = tools.map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                }));
            }

            if (capabilities.prompts) {
                const response = await client.listPrompts();
                const prompts = (response as unknown) as Array<{
                    name: string;
                    description?: string;
                    parameters: Record<string, any>;
                }>;
                responses.prompts = prompts.map(prompt => ({
                    name: prompt.name,
                    description: prompt.description,
                    parameters: prompt.parameters,
                }));
            }

            return responses;
        } catch (error) {
            console.error('Failed to refresh server responses:', error);
            throw new Error('Failed to refresh server responses');
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
            this.clients.delete(serverId);
        } catch (error) {
            console.error('Failed to stop MCP server:', error);
            throw new Error('Failed to stop MCP server');
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