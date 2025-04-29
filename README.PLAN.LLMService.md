# Centralized LLM Service Implementation Plan

## Overview

This document outlines the implementation plan for a centralized LLM (Large Language Model) service within the Charm MCP application. The service will provide standardized access to LLM capabilities for all MCP servers, including MediK MCP, without modifying the existing chat functionality. By centralizing LLM access, we ensure consistent behavior, efficient resource usage, and simplified maintenance.

**Implementation Status:**
- ✅ Core LLM Service (`src/server/services/llm/index.ts`)
- ✅ Type Definitions (`src/server/services/llm/types.ts`)
- ✅ Anthropic Provider (`src/server/services/llm/providers/anthropic.ts`)
- ✅ Response Caching (`src/server/services/llm/cache.ts`)
- ✅ Utility Functions (`src/server/services/llm/utils.ts`)
- ✅ MCP Client Library (`custom-mcp-servers/mcp-helpers/llm-client.ts`)
- ✅ API Endpoints (`src/server/routes/api/internal/llm.ts`)
- ✅ Integration with Main Application Server (complete)
- ❌ Integration with MediK Pathfinder (pending)
- ❌ Admin Monitoring Endpoints (planned for future)
- ❌ Usage Tracking (planned for future)

The service is built around Anthropic's Claude model (specifically claude-3-5-sonnet-20241022) and provides:

- **Structured Output Options**: Support for multiple response formats (JSON, text, markdown) with automatic validation and repair of structured outputs
- **Flexible System Prompts**: Per-request system prompts with sensible defaults for different operations
- **Specialized Methods**: Task-specific methods with standardized prompt templates for common operations like analysis and ranking
- **Performance Optimization**: Response caching to reduce API costs and improve response times
- **Security Controls**: Authentication and rate limiting to protect the service from misuse

This service allows MCP servers like MediK to leverage LLM capabilities without directly integrating with LLM APIs, creating a clean separation of concerns in the architecture.

## 1. Core Architecture

### 1.1 Service Structure

The LLM Service will be implemented as a standalone module within the main application:

```
src/
├── server/
│   ├── services/
│   │   ├── llm/
│   │   │   ├── index.ts          # Main service export ✅
│   │   │   ├── providers/        # LLM provider implementations
│   │   │   │   ├── anthropic.ts  # Anthropic/Claude integration ✅
│   │   │   │   └── openai.ts     # Optional OpenAI integration (future)
│   │   │   ├── cache.ts          # Response caching ✅
│   │   │   ├── types.ts          # Type definitions ✅
│   │   │   └── utils.ts          # Helper utilities ✅
│   │   ├── mcp.ts                # Existing MCP service
│   │   └── ...
│   └── ...
└── ...
```

**Note on Prompt Handling**: In the initial implementation, MCPs will directly provide prompts in their requests. A prompt registry system (planned for future versions) will eventually provide standardized, reusable prompts for common tasks.

### Future Enhancement - Prompt Registry (v2)
For a future version, we plan to implement a prompt registry system that will:
- Centralize prompt management in standardized templates
- Enable versioning and optimization of prompts
- Organize domain-specific prompts by category (analysis, ranking, etc.)
- Allow MCPs to reference prompts by ID rather than sending full prompt text

```
# Future directory structure addition (v2)
src/
├── server/
│   ├── services/
│   │   ├── llm/
│   │   │   ├── prompts/          # Added in v2
│   │   │   │   ├── index.ts      # Prompt registry
│   │   │   │   ├── analysis.ts   # Data analysis prompts
│   │   │   │   └── ranking.ts    # Ranking/prioritization prompts
│   │   │   └── ...
│   │   ├── ...
│   └── ...
└── ...
```

### 1.2 Core Service Interface ✅

The LLM Service will provide a clean, promise-based API:

```typescript
// Basic interface (src/server/services/llm/types.ts) ✅
export interface LLMServiceOptions {
  provider?: 'anthropic' | 'openai';
  model?: string;
  temperature?: number;
  maxTokens?: number;
  cacheResponses?: boolean;
}

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  responseFormat?: 'json' | 'text' | 'markdown';
  contextData?: Record<string, any>;
  options?: Partial<LLMServiceOptions>;
}

export interface LLMResponse {
  content: string;
  rawResponse?: any;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cached?: boolean;
}

// Main service class (simplified) ✅
export class LLMService {
  constructor(options?: LLMServiceOptions);
  
  // Core method for direct prompt/response
  async query(request: LLMRequest): Promise<LLMResponse>;
  
  // Specialized methods for common use cases
  async analyze(data: any, task: string, options?: Partial<LLMRequest>): Promise<LLMResponse>;
  async rank(items: any[], criteria: string, options?: Partial<LLMRequest>): Promise<any[]>;
  async extractJSON<T>(prompt: string, options?: Partial<LLMRequest>): Promise<T>;
}
``` 

## 2. MCP Integration

### 2.1 MCP Access Method ✅

To allow MCP servers to access the LLM Service without modifying the existing chat flow, we'll implement an internal API endpoint:

```typescript
// In src/server/routes/api/internal/llm.ts ✅
import { Router } from 'express';
import { LLMService } from '../../../services/llm';
import { authenticateMCPRequest } from '../../../middleware/auth';

const router = Router();
const llmService = new LLMService();

// POST endpoint for LLM queries from MCP servers
router.post('/query', authenticateMCPRequest, async (req, res) => {
  try {
    const { prompt, systemPrompt, responseFormat, contextData, options } = req.body;
    
    // Log request (for monitoring/debugging)
    console.log(`[LLM Service] Request from MCP:`, {
      mcpName: req.mcp?.name,
      promptLength: prompt?.length,
      responseFormat
    });
    
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
  } catch (error) {
    console.error('[LLM Service] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Specialized endpoints for common use cases
router.post('/analyze', authenticateMCPRequest, async (req, res) => {
  try {
    const { data, task, options } = req.body;
    const response = await llmService.analyze(data, task, options);
    return res.json({
      success: true,
      content: response.content,
      usage: response.usage
    });
  } catch (error) {
    console.error('[LLM Service] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/rank', authenticateMCPRequest, async (req, res) => {
  try {
    const { items, criteria, options } = req.body;
    const rankedItems = await llmService.rank(items, criteria, options);
    return res.json({
      success: true,
      items: rankedItems
    });
  } catch (error) {
    console.error('[LLM Service] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
```

### 2.2 Helper Library for MCP Servers ✅

To simplify integration with MCP servers, we'll create a shared helper library:

```typescript
// In custom-mcp-servers/mcp-helpers/llm-client.ts ✅
import fetch from 'node-fetch';

export interface LLMClientOptions {
  baseUrl?: string;
  timeout?: number;
}

export class LLMClient {
  private baseUrl: string;
  private timeout: number;
  
  constructor(options: LLMClientOptions = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000/api/internal/llm';
    this.timeout = options.timeout || 30000;
  }
  
  async query(params: {
    prompt: string;
    systemPrompt?: string;
    responseFormat?: 'json' | 'text' | 'markdown';
    contextData?: Record<string, any>;
    options?: Record<string, any>;
  }) {
    const response = await fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MCP-Auth': process.env.MCP_AUTH_TOKEN || ''
      },
      body: JSON.stringify(params),
      timeout: this.timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM query failed: ${response.status} ${errorText}`);
    }
    
    return response.json();
  }
  
  async analyze(data: any, task: string, options = {}) {
    const response = await fetch(`${this.baseUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MCP-Auth': process.env.MCP_AUTH_TOKEN || ''
      },
      body: JSON.stringify({ data, task, options }),
      timeout: this.timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM analysis failed: ${response.status} ${errorText}`);
    }
    
    return response.json();
  }
  
  async rank(items: any[], criteria: string, options = {}) {
    const response = await fetch(`${this.baseUrl}/rank`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MCP-Auth': process.env.MCP_AUTH_TOKEN || ''
      },
      body: JSON.stringify({ items, criteria, options }),
      timeout: this.timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM ranking failed: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    return result.items;
  }
}
```

### 2.3 MediK MCP Integration Example

Here's how the MediK MCP would use the LLM client for pathfinding:

```typescript
// In custom-mcp-servers/medik-mcp/src/pathfinder.ts
import { LLMClient } from '../../mcp-helpers/llm-client';

// Initialize the client
const llmClient = new LLMClient();

// Use in the pathfinder logic
async function rankPromisingSources(sourceNodes, targetNodes) {
  try {
    // Format nodes for ranking
    const formattedSourceNodes = sourceNodes.map(node => ({
      id: node.id,
      name: node.name,
      category: node.metadata?.category,
      relationships: node.relationships?.length || 0
    }));
    
    const formattedTargetNodes = targetNodes.map(node => ({
      id: node.id,
      name: node.name,
      category: node.metadata?.category,
      relationships: node.relationships?.length || 0
    }));
    
    // Use LLM to rank
    const result = await llmClient.query({
      prompt: `Given these source and target nodes, identify the pairs that are most likely to be connected through intermediate concepts.
      
      Source nodes: ${JSON.stringify(formattedSourceNodes)}
      Target nodes: ${JSON.stringify(formattedTargetNodes)}
      
      Consider biological plausibility, relationship types, and semantic similarity.`,
      responseFormat: 'json',
      options: {
        temperature: 0.3,
        maxTokens: 2000
      }
    });
    
    // Parse and return ranked pairs
    return JSON.parse(result.content);
  } catch (error) {
    console.error('Error ranking nodes with LLM:', error);
    // Fallback to a simpler ranking method if LLM fails
    return fallbackRanking(sourceNodes, targetNodes);
  }
}
``` 

## 3. Implementation Details

### 3.1 LLM Provider Integration ✅

The service will initially support Anthropic's Claude model (already in use in the application) with potential for adding other providers:

```typescript
// src/server/services/llm/providers/anthropic.ts ✅
import { Anthropic } from '@anthropic-ai/sdk';
import { LLMProvider, LLMProviderOptions, LLMProviderResponse } from '../types';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private defaultModel: string;
  
  constructor(options: LLMProviderOptions = {}) {
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }
    
    this.client = new Anthropic({ apiKey });
    this.defaultModel = options.model || 'claude-3-5-sonnet-20241022';
  }
  
  async query(prompt: string, options: LLMProviderOptions = {}): Promise<LLMProviderResponse> {
    const model = options.model || this.defaultModel;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || 4000;
    const systemPrompt = options.systemPrompt || '';
    
    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });
      
      return {
        content: response.content[0].text,
        rawResponse: response,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens
        }
      };
    } catch (error) {
      console.error('Anthropic query error:', error);
      throw new Error(`Anthropic query failed: ${error.message}`);
    }
  }
}
```

### 3.2 Response Caching ✅

To optimize performance and reduce API costs, the service will implement response caching:

```typescript
// src/server/services/llm/cache.ts ✅
import NodeCache from 'node-cache';
import { LLMResponse } from './types';
import { createHash } from 'crypto';

export interface LLMCacheOptions {
  ttl?: number;        // Time to live in seconds
  maxKeys?: number;    // Maximum number of cache entries
}

export class LLMCache {
  private cache: NodeCache;
  
  constructor(options: LLMCacheOptions = {}) {
    this.cache = new NodeCache({
      stdTTL: options.ttl || 3600, // Default: 1 hour
      maxKeys: options.maxKeys || 1000,
      checkperiod: 60 // Check for expired keys every 60 seconds
    });
  }
  
  // Generate a deterministic cache key from request parameters
  private generateKey(prompt: string, options: Record<string, any> = {}): string {
    // Create a stable representation of the request
    const requestData = JSON.stringify({
      prompt,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      systemPrompt: options.systemPrompt,
      responseFormat: options.responseFormat
    });
    
    // Generate hash for the request data
    return createHash('md5').update(requestData).digest('hex');
  }
  
  // Store a response in cache
  set(prompt: string, response: LLMResponse, options: Record<string, any> = {}): void {
    const key = this.generateKey(prompt, options);
    const ttl = options.cacheTTL || undefined; // Use custom TTL if provided
    
    this.cache.set(key, response, ttl);
  }
  
  // Get a cached response
  get(prompt: string, options: Record<string, any> = {}): LLMResponse | undefined {
    const key = this.generateKey(prompt, options);
    const cachedResponse = this.cache.get<LLMResponse>(key);
    
    if (cachedResponse) {
      // Mark response as retrieved from cache
      return {
        ...cachedResponse,
        cached: true
      };
    }
    
    return undefined;
  }
  
  // Check if a response is cached
  has(prompt: string, options: Record<string, any> = {}): boolean {
    const key = this.generateKey(prompt, options);
    return this.cache.has(key);
  }
  
  // Clear the entire cache or specific entries
  clear(prompt?: string, options?: Record<string, any>): void {
    if (prompt && options) {
      const key = this.generateKey(prompt, options);
      this.cache.del(key);
    } else {
      this.cache.flushAll();
    }
  }
  
  // Get cache stats
  getStats() {
    return {
      keys: this.cache.keys().length,
      stats: this.cache.getStats()
    };
  }
}
```

### 3.3 Main Service Implementation ✅

The core service implementation that ties everything together:

```typescript
// src/server/services/llm/index.ts ✅
import { AnthropicProvider } from './providers/anthropic';
import { LLMCache } from './cache';
import { 
  LLMService as LLMServiceInterface,
  LLMServiceOptions,
  LLMRequest,
  LLMResponse,
  LLMProvider
} from './types';

export class LLMService implements LLMServiceInterface {
  private provider: LLMProvider;
  private cache: LLMCache;
  private options: LLMServiceOptions;
  
  constructor(options: LLMServiceOptions = {}) {
    this.options = {
      provider: options.provider || 'anthropic',
      model: options.model || 'claude-3-5-sonnet-20241022',
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens || 4000,
      cacheResponses: options.cacheResponses ?? true
    };
    
    // Initialize provider
    if (this.options.provider === 'anthropic') {
      this.provider = new AnthropicProvider({
        model: this.options.model
      });
    } else {
      throw new Error(`Unsupported LLM provider: ${this.options.provider}`);
    }
    
    // Initialize cache
    this.cache = new LLMCache();
  }
  
  async query(request: LLMRequest): Promise<LLMResponse> {
    const { prompt, systemPrompt, responseFormat, contextData, options = {} } = request;
    
    // Merge default options with request-specific options
    const mergedOptions = {
      ...this.options,
      ...options,
      systemPrompt
    };
    
    // Check cache if enabled
    if (this.options.cacheResponses && !options.skipCache) {
      const cachedResponse = this.cache.get(prompt, mergedOptions);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    // Get response from provider
    const response = await this.provider.query(prompt, mergedOptions);
    
    // Process response based on requested format
    let processedContent = response.content;
    
    if (responseFormat === 'json') {
      try {
        // Validate that the response is valid JSON
        JSON.parse(processedContent);
      } catch (error) {
        console.warn('Response is not valid JSON. Attempting to extract JSON...');
        // Try to extract JSON from the response
        const jsonMatch = processedContent.match(/```(?:json)?\s*({[\s\S]*?}|\[[\s\S]*?\])\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          processedContent = jsonMatch[1].trim();
          try {
            // Validate extracted JSON
            JSON.parse(processedContent);
          } catch (e) {
            console.error('Failed to extract valid JSON from response');
          }
        }
      }
    }
    
    const finalResponse: LLMResponse = {
      ...response,
      content: processedContent
    };
    
    // Cache response if caching is enabled
    if (this.options.cacheResponses) {
      this.cache.set(prompt, finalResponse, mergedOptions);
    }
    
    return finalResponse;
  }
  
  async analyze(data: any, task: string, options: Partial<LLMRequest> = {}): Promise<LLMResponse> {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    
    const prompt = `
# Analysis Task
${task}

# Data to Analyze
${dataString}

Analyze the data according to the task. Provide a thorough, accurate analysis.
`;
    
    return this.query({
      prompt,
      responseFormat: options.responseFormat || 'text',
      systemPrompt: options.systemPrompt,
      options: options.options
    });
  }
  
  async rank<T extends any[]>(items: T, criteria: string, options: Partial<LLMRequest> = {}): Promise<T> {
    const itemsString = JSON.stringify(items, null, 2);
    
    const prompt = `
# Ranking Task
Rank the following items based on this criteria: ${criteria}

# Items to Rank
${itemsString}

Return the items in ranked order (best match first) as a valid JSON array.
Maintain the same structure and properties for each item.
Do not add or remove any items. Only reorder them based on the criteria.
`;
    
    const response = await this.query({
      prompt,
      responseFormat: 'json',
      systemPrompt: options.systemPrompt || 'You are an expert at ranking and prioritizing items based on specific criteria.',
      options: {
        temperature: 0.3, // Lower temperature for more consistent rankings
        ...options.options
      }
    });
    
    try {
      return JSON.parse(response.content);
    } catch (error) {
      console.error('Failed to parse ranked items:', error);
      throw new Error('Failed to parse ranked items JSON');
    }
  }
  
  async extractJSON<T>(prompt: string, options: Partial<LLMRequest> = {}): Promise<T> {
    const enhancedPrompt = `
${prompt}

Return your response as a valid, parseable JSON object.
Do not include any explanations or markdown formatting around the JSON.
Ensure all properties are properly quoted and syntax is valid.
`;
    
    const response = await this.query({
      prompt: enhancedPrompt,
      responseFormat: 'json',
      ...options
    });
    
    try {
      return JSON.parse(response.content);
    } catch (error) {
      console.error('Failed to parse JSON response:', error);
      throw new Error('Failed to extract valid JSON from response');
    }
  }
} 

## 4. Application Integration

### 4.1 Server Integration ✅ (Complete)

To integrate the LLM Service into the main application server:

```typescript
// In src/server/index.ts
import express from 'express';
import { LLMService } from './services/llm';
import llmRoutes from './routes/api/internal/llm';

// Initialize app
const app = express();

// Initialize services
const llmService = new LLMService();

// Add service to app locals
app.locals.llmService = llmService;

// Add routes
app.use('/api/internal/llm', llmRoutes);

// ... other app setup
```

### 4.2 Environment Configuration ✅ (Complete)

Add the necessary environment variables to the application:

```
# In .env file
ANTHROPIC_API_KEY=<your_api_key>
LLM_SERVICE_DEFAULT_MODEL=claude-3-5-sonnet-20241022
LLM_SERVICE_CACHE_TTL=3600
LLM_SERVICE_MAX_CACHE_KEYS=1000
```

## 5. Security Considerations

### 5.1 Authentication

The internal API endpoints will be protected with an MCP authentication middleware:

```typescript
// In src/server/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';

export function authenticateMCPRequest(req: Request, res: Response, next: NextFunction) {
  const authToken = req.headers['x-mcp-auth'];
  
  // In development, allow localhost without auth
  if (process.env.NODE_ENV === 'development' && req.ip === '::1') {
    req.mcp = { name: 'localhost', authenticated: true };
    return next();
  }
  
  // Validate MCP auth token
  if (!authToken || authToken !== process.env.MCP_AUTH_TOKEN) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or missing authentication token'
    });
  }
  
  // Add MCP info to request
  const mcpName = req.headers['x-mcp-name'] || 'unknown-mcp';
  req.mcp = {
    name: mcpName,
    authenticated: true
  };
  
  next();
}
```

### 5.2 Rate Limiting

Implement rate limiting to prevent abuse of the LLM service:

```typescript
// In src/server/routes/api/internal/llm.ts
import rateLimit from 'express-rate-limit';

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  }
});

// Apply rate limiting to LLM routes
router.use(limiter);
``` 

## 6. Monitoring and Analytics

### 6.1 Usage Tracking

Add usage tracking to monitor LLM API consumption:

```typescript
// In src/server/services/llm/tracking.ts
import { createClient } from 'redis';
import { LLMUsageEvent } from './types';

export class UsageTracker {
  private redis;
  private namespace: string;
  
  constructor(namespace = 'llm-service') {
    this.namespace = namespace;
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    this.redis.connect().catch(err => {
      console.error('Redis connection error:', err);
    });
  }
  
  async trackUsage(event: LLMUsageEvent): Promise<void> {
    try {
      // Store usage event
      const timestamp = new Date().toISOString();
      const eventId = `${this.namespace}:usage:${timestamp}:${Math.random().toString(36).substring(2, 10)}`;
      
      await this.redis.hSet(eventId, {
        timestamp,
        provider: event.provider,
        model: event.model,
        promptTokens: event.usage.promptTokens,
        completionTokens: event.usage.completionTokens,
        totalTokens: event.usage.totalTokens,
        cached: event.cached ? 1 : 0,
        mcpName: event.mcpName || 'unknown',
        responseFormat: event.responseFormat || 'text'
      });
      
      // Update daily counters
      const todayKey = `${this.namespace}:tokens:${new Date().toISOString().split('T')[0]}`;
      await this.redis.incrBy(`${todayKey}:total`, event.usage.totalTokens);
    } catch (error) {
      console.error('Error tracking LLM usage:', error);
    }
  }
  
  async getUsageSummary(days = 30): Promise<any> {
    // Implementation for retrieving usage statistics
    // ...
  }
}
```

### 6.2 Admin Endpoints

Add admin endpoints to monitor and manage the LLM service:

```typescript
// In src/server/routes/api/admin/llm.ts
import { Router } from 'express';
import { authenticateAdmin } from '../../../middleware/auth';

const router = Router();

// Get usage statistics
router.get('/usage', authenticateAdmin, async (req, res) => {
  const llmService = req.app.locals.llmService;
  const days = parseInt(req.query.days as string) || 30;
  
  try {
    const usageSummary = await llmService.usageTracker.getUsageSummary(days);
    return res.json({
      success: true,
      data: usageSummary
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get cache stats
router.get('/cache', authenticateAdmin, (req, res) => {
  const llmService = req.app.locals.llmService;
  const cacheStats = llmService.cache.getStats();
  
  return res.json({
    success: true,
    data: cacheStats
  });
});

// Clear cache
router.post('/cache/clear', authenticateAdmin, (req, res) => {
  const llmService = req.app.locals.llmService;
  llmService.cache.clear();
  
  return res.json({
    success: true,
    message: 'Cache cleared successfully'
  });
});

export default router;
```

## 7. Implementation Timeline

### 7.1 Phase 1: Core Implementation (1-2 weeks) ✅

1. ✅ Set up basic service structure (1-2 days)
2. ✅ Implement Anthropic provider integration (1 day)
3. ✅ Create LLM service core functionality (2-3 days)
4. ✅ Add internal API endpoints (1 day)
5. ✅ Implement MCP helper library (1 day)
6. ✅ Basic testing and debugging (1-2 days)

### 7.2 Phase 2: Enhanced Features (1-2 weeks) ⏳

1. ✅ Implement caching system (2-3 days)
2. ❌ Add usage tracking (1-2 days) (pending)
3. ❌ Create admin monitoring endpoints (1 day) (pending)
4. ✅ Implement security measures (1 day)
5. ✅ Documentation and examples (1 day)
6. ✅ Integration with main application (1 day)

### 7.3 Phase 3: Integration with MediK Pathfinder (1 week) ❌

1. ❌ Update MediK MCP to use LLM service (2-3 days) (pending)
2. ❌ Test integration with pathfinding algorithm (1-2 days) (pending)
3. ❌ Performance optimization (1-2 days) (pending)

## 8. Success Criteria

The LLM Service implementation will be considered successful if:

1. **Functionality**: All MCP servers can access LLM capabilities without modifying the existing chat system
2. **Performance**: Response time is acceptable (<5 seconds for typical requests)
3. **Reliability**: Error rate is minimal (<1%)
4. **Efficiency**: Caching reduces redundant API calls by at least 30%
5. **Security**: All endpoints are properly authenticated and rate-limited
6. **Monitoring**: Usage tracking provides clear visibility into consumption patterns
7. **Integration**: MediK Pathfinder can successfully use the service for node ranking

## 9. Future Enhancements

### 9.1 Additional Features

- Support for streaming responses
- Additional LLM providers (OpenAI, local models)
- More specialized endpoints for common use cases
- Function calling capabilities
- **Prompt Registry System**: 
  - Centralized repository of optimized prompts
  - Versioning and A/B testing capabilities
  - Domain-specific prompt templates (biomedical, legal, etc.)
  - Prompt reference by ID instead of full text

### 9.2 Performance Improvements

- Distributed caching with Redis
- Response streaming to clients
- Parallel processing for batch requests
- Progressive response generation

### 9.3 Developer Experience

- Improved error handling and debugging
- Better documentation and examples
- SDK for client-side integration
- Testing utilities for LLM-dependent features 