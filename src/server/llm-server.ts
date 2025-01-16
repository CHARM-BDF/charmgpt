import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from 'zod';
import { Anthropic } from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatParams {
    message: string;
    history: ChatMessage[];
}

async function startServer() {
    // Define the chat tool's input schema
    const chatToolSchema = z.object({
        message: z.string(),
        history: z.array(z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string()
        }))
    });

    // Create server instance
    const server = new Server(
        {
            name: 'llm-chat-server',
            version: '1.0.0'
        },
        {
            capabilities: {
                tools: {
                    chat: {
                        name: 'chat',
                        description: 'Chat with Claude AI model',
                        inputSchema: chatToolSchema,
                        handler: async (params: ChatParams) => {
                            try {
                                // Convert history to Anthropic's format
                                const messages = params.history.map((msg: ChatMessage) => ({
                                    role: msg.role,
                                    content: msg.content
                                }));

                                // Add the current message
                                messages.push({
                                    role: 'user' as const,
                                    content: params.message
                                });

                                // Call Claude
                                const response = await anthropic.messages.create({
                                    model: 'claude-3-sonnet-20240229',
                                    max_tokens: 1000,
                                    messages: messages,
                                    temperature: 0.7,
                                });

                                // Get the response content
                                if (response.content[0].type !== 'text') {
                                    throw new Error('Expected text response from Claude');
                                }

                                return {
                                    content: response.content[0].text
                                };
                            } catch (error) {
                                console.error('Error calling Claude:', error);
                                throw error;
                            }
                        }
                    }
                }
            }
        }
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
}

// Start the server
startServer().catch(console.error); 