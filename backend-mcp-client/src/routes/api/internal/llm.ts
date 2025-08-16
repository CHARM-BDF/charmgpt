/**
 * LLM Service API Routes
 * 
 * This file implements the internal API endpoints for the LLM Service.
 * These endpoints are used by MCP servers to access LLM capabilities.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { LLMService } from '../../../services/llm';

// Extend Request type to include MCP info
interface MCPRequest extends Request {
  mcp?: {
    name: string;
    authenticated: boolean;
  };
}

// Create router
const router = Router();

// Authentication middleware for MCP requests
// This is a placeholder - implement actual authentication logic in a real middleware
const authenticateMCPRequest = (req: MCPRequest, res: Response, next: NextFunction): void => {
  const authToken = req.headers['x-mcp-auth'];
  
  // In development, allow localhost without auth
  if (process.env.NODE_ENV === 'development' && req.ip === '::1') {
    req.mcp = { name: 'localhost', authenticated: true };
    return next();
  }
  
  // Validate MCP auth token (placeholder logic)
  if (!authToken || authToken !== process.env.MCP_AUTH_TOKEN) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing authentication token'
    });
    return;
  }
  
  // Add MCP info to request
  const mcpName = req.headers['x-mcp-name'] || 'unknown-mcp';
  req.mcp = {
    name: typeof mcpName === 'string' ? mcpName : 'unknown-mcp',
    authenticated: true
  };
  
  next();
};

// Get LLM service from app locals
const getLLMService = (req: Request): LLMService => {
  const llmService = req.app.locals.llmService;
  if (!llmService) {
    throw new Error('LLM Service not initialized');
  }
  return llmService;
};

// POST endpoint for LLM queries from MCP servers
router.post('/query', authenticateMCPRequest, async (req: MCPRequest, res: Response) => {
  try {
    const { prompt, systemPrompt, responseFormat, contextData, options } = req.body;
    
    // Validate required parameters
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: prompt'
      });
    }
    
    // Log request (for monitoring/debugging)
    console.log(`[LLM Service] Request from MCP:`, {
      mcpName: req.mcp?.name,
      promptLength: prompt?.length,
      responseFormat
    });
    
    // Get LLM service
    const llmService = getLLMService(req);
    
    // Execute query
    const response = await llmService.query({
      prompt,
      systemPrompt,
      responseFormat,
      contextData,
      options
    });
    
    // Return response
    return res.json({
      success: true,
      content: response.content,
      usage: response.usage,
      cached: response.cached
    });
  } catch (error: unknown) {
    console.error('[LLM Service API] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Specialized endpoints for common use cases
router.post('/analyze', authenticateMCPRequest, async (req: MCPRequest, res: Response) => {
  try {
    const { data, task, options } = req.body;
    
    // Validate required parameters
    if (!data || !task) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: data and task'
      });
    }
    
    // Get LLM service
    const llmService = getLLMService(req);
    
    // Execute analysis
    const response = await llmService.analyze(data, task, options);
    
    // Return response
    return res.json({
      success: true,
      content: response.content,
      usage: response.usage,
      cached: response.cached
    });
  } catch (error: unknown) {
    console.error('[LLM Service API] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/rank', authenticateMCPRequest, async (req: MCPRequest, res: Response) => {
  try {
    const { items, criteria, options } = req.body;
    
    // Validate required parameters
    if (!items || !criteria) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: items and criteria'
      });
    }
    
    // Get LLM service
    const llmService = getLLMService(req);
    
    // Execute ranking
    const rankedItems = await llmService.rank(items, criteria, options);
    
    // Return response
    return res.json({
      success: true,
      items: rankedItems
    });
  } catch (error: unknown) {
    console.error('[LLM Service API] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 