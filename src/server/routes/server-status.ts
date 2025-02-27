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
    
    // Extract unique server names from tool names
    const serverNames = new Set<string>();
    tools.forEach(tool => {
        const serverName = tool.name.split('-')[0];
        if (serverName) {
            serverNames.add(serverName);
        }
    });
    
    // For each server, get its tools
    for (const serverName of serverNames) {
        try {
            // Filter tools for this server
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
    
    return serverStatuses;
}

export default router; 