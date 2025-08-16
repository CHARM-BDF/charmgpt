import express, { Request, Response } from 'express';
import { MCPService } from '../services/mcp';
import { LoggingService } from '../services/logging';

const router = express.Router();

/**
 * Server Status Endpoint
 * Returns the operational status and available tools for each MCP server
 * GET /api/server-status
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const mcpService = req.app.locals.mcpService as MCPService;
        const loggingService = req.app.locals.loggingService as LoggingService;
        
        loggingService.log('info', 'Fetching server status');
        loggingService.logRequest(req);
        
        // Get all MCP clients from the service
        const serverStatuses = await getServerStatuses(mcpService);
        
        loggingService.log('info', `Server status fetched for ${serverStatuses.length} servers`);
        
        res.json({ servers: serverStatuses });
        loggingService.logResponse(res);
    } catch (error) {
        const loggingService = req.app.locals.loggingService as LoggingService;
        loggingService.logError(error as Error);
        
        console.error('Failed to get server status:', error);
        res.status(500).json({
            error: 'Failed to get server status',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Helper function to get status of all MCP servers
 * @param mcpService - The MCP service instance
 * @returns Array of server status objects
 */
async function getServerStatuses(mcpService: MCPService) {
    interface ServerTool {
        name: string;
        description?: string;
        inputSchema?: {
            type: string;
            properties?: Record<string, unknown>;
            required?: string[];
        };
    }

    interface ServerStatus {
        name: string;
        isRunning: boolean;
        tools?: ServerTool[];
        status?: string; // For compatibility with the frontend
    }
    
    const serverStatuses: ServerStatus[] = [];
    
    // Get all available tools to extract server information
    const tools = await mcpService.getAllAvailableTools([]);
    
    // Get server names directly from mcpService instead of parsing from tool names
    // This ensures we get the exact technical names without any splitting/parsing
    const serverNames = mcpService.getServerNames();
    
    // Add detailed logging of server names
    console.log('\n=== DEBUG: getServerStatuses ===');
    console.log('Available server names from mcpService:', JSON.stringify(Array.from(serverNames)));
    console.log('Total server names:', serverNames.size);
    
    // For each server, get its tools
    for (const serverName of serverNames) {
        try {
            // Filter tools for this server - use startsWith to match the prefix pattern
            const serverTools = tools
                .filter(tool => tool.name.startsWith(`${serverName}-`))
                .map(tool => ({
                    name: tool.name.substring(serverName.length + 1), // Remove server prefix
                    description: tool.description,
                    inputSchema: {
                        type: tool.input_schema.type,
                        properties: tool.input_schema.properties,
                        required: tool.input_schema.required
                    }
                }));
            
            // Check if server is running based on tool availability
            const isRunning = serverTools.length > 0;
            
            serverStatuses.push({
                name: serverName,
                isRunning,
                tools: serverTools,
                status: isRunning ? 'active' : 'inactive' // For compatibility with the frontend
            });
        } catch (error) {
            console.error(`Failed to get status for server ${serverName}:`, error);
            serverStatuses.push({
                name: serverName,
                isRunning: false,
                tools: [],
                status: 'inactive'
            });
        }
    }
    
    // Log the final server status list
    console.log('Server statuses to be returned to client:');
    serverStatuses.forEach(s => {
        console.log(`  ${s.name}: ${s.status} (isRunning: ${s.isRunning}, tools: ${s.tools?.length || 0})`);
    });
    console.log('=== END DEBUG: getServerStatuses ===\n');
    
    return serverStatuses;
}

export default router; 