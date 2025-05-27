/**
 * LLM Service Implementation with LangGraph React Agent
 * 
 * This file implements the main LLM Service that provides centralized
 * access to LLM capabilities using LangGraph React agents with MCP integration.
 */

import { LangGraphProvider } from './providers/langgraph';
import { LLMCache } from './cache';
import { extractJSONFromText } from './utils';
import { 
  LLMService as LLMServiceInterface,
  LLMServiceOptions,
  LLMRequest,
  LLMResponse
} from './types';

interface MCPServerConfig {
  command?: string;
  args?: string[];
  transport?: string;
  url?: string;
  type?: string;
  env?: Record<string, string>;
  encoding?: string;
  stderr?: string;
  cwd?: string;
  restart?: Record<string, unknown>;
}

/**
 * Main implementation of the LLM Service using LangGraph React Agent
 */
export class LLMService implements LLMServiceInterface {
  /** LangGraph provider instance */
  private provider: LangGraphProvider | null = null;
  /** Cache for LLM responses */
  private _cache: LLMCache;
  /** Service configuration */
  private options: LLMServiceOptions;
  /** MCP servers configuration */
  private mcpServers: Record<string, MCPServerConfig> = {};
  
  /**
   * Create a new LLM Service with LangGraph React Agent
   * @param options Service configuration options
   */
  constructor(options: LLMServiceOptions = {}) {
    this.options = {
      provider: options.provider || 'anthropic',
      model: options.model || 'claude-3-5-sonnet-20241022',
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens || 4000,
      cacheResponses: options.cacheResponses ?? true
    };
    
    console.log(`LLMService: Initialized with LangGraph React Agent - provider will be set on first use`);
    
    // Initialize cache
    this._cache = new LLMCache();
    
    console.log('LLMService: Initialization complete with LangGraph integration');
  }
  
  /**
   * Initialize provider based on the current options
   */
  private initializeProvider(): void {
    const providerName = this.options.provider || 'anthropic';
    console.log(`🔄 LLMService: Initializing LangGraph provider with ${providerName.toUpperCase()} backend`);
    
    // Create LangGraph provider with the specified backend
    this.provider = new LangGraphProvider({
      provider: providerName,
      model: this.options.model,
      temperature: this.options.temperature,
      maxTokens: this.options.maxTokens,
      mcpServers: this.mcpServers
    });
  }
  
  /**
   * Change the LLM provider at runtime
   * @param options New provider options
   */
  setProvider(options: LLMServiceOptions): void {
    if (!options.provider) {
      console.error('❌ LLMService: No provider specified in options');
      return;
    }
    
    const providerName = options.provider;
    console.log(`🔀 LLMService: Switching LangGraph to ${providerName.toUpperCase()} backend`);
    
    // Update options with the new provider settings
    this.options = {
      ...this.options,
      ...options
    };
    
    // Reset model to provider-specific defaults if not explicitly set in options
    // or if current model is incompatible with the new provider
    if (!options.model || this.isIncompatibleModel(providerName, this.options.model)) {
      if (providerName === 'anthropic') {
        this.options.model = 'claude-3-5-sonnet-20241022';
        console.log(`LLMService: Using default Anthropic model: ${this.options.model}`);
      } else if (providerName === 'openai') {
        this.options.model = 'gpt-4-turbo-preview';
        console.log(`LLMService: Using default OpenAI model: ${this.options.model}`);
      } else if (providerName === 'gemini') {
        this.options.model = 'gemini-2.0-flash';
        console.log(`LLMService: Using default Gemini model: ${this.options.model}`);
      } else if (providerName === 'ollama') {
        this.options.model = 'llama3.2:latest';
        console.log(`LLMService: Using default Ollama model: ${this.options.model}`);
      }
    }
    
    try {
      this.initializeProvider();
      console.log(`✅ LLMService: LangGraph provider with ${providerName.toUpperCase()} backend initialized successfully`);
    } catch (error) {
      console.error(`❌ LLMService: Error in setProvider for ${providerName}:`, error);
    }
  }
  
  /**
   * Check if a model is incompatible with a provider
   * @param provider The provider name
   * @param model The model name
   * @returns True if the model is incompatible with the provider
   */
  private isIncompatibleModel(provider: string, model: string | undefined): boolean {
    if (!model) return true;
    
    if (provider === 'anthropic' && !model.includes('claude')) {
      return true;
    } else if (provider === 'openai' && model.includes('claude')) {
      return true;
    } else if (provider === 'gemini' && (model.includes('claude') || model.includes('gpt'))) {
      return true;
    } else if (provider === 'ollama' && (model.includes('claude') || model.includes('gpt') || model.includes('gemini'))) {
      return true;
    }
    return false;
  }
  
  /**
   * Get the current provider name
   * @returns The current provider name
   */
  getProvider(): string {
    return this.options.provider || 'anthropic';
  }
  
  /**
   * Send a query to the LLM
   * @param request The request parameters
   * @returns The processed response
   */
  async query(request: LLMRequest): Promise<LLMResponse> {
    const { prompt, systemPrompt, responseFormat, contextData, options = {} } = request;
    
    // Use type assertion to bypass type checking for debugging
    const debugOptions = options as any;
    
    // Debug logging for options
    console.log(`🔍 DEBUG-LLM-SERVICE: Query options received:`, JSON.stringify({
      provider: this.options.provider,
      responseFormat,
      hasSystemPrompt: !!systemPrompt,
      hasToolChoice: !!debugOptions.toolChoice,
      hasTools: !!(debugOptions.tools && Array.isArray(debugOptions.tools) && debugOptions.tools.length > 0)
    }));
    
    // If there are tools, log additional info
    if (debugOptions.tools && Array.isArray(debugOptions.tools) && debugOptions.tools.length > 0) {
      console.log(`🔍 DEBUG-LLM-SERVICE: Received ${debugOptions.tools.length} tools, first tool:`, 
        debugOptions.tools[0].function?.name || 'unknown structure');
      
      // Check if pubmed tool is in tools list
      const hasPubmedTool = debugOptions.tools.some((tool: any) => 
        (tool.function?.name && tool.function.name.includes('pubmed')) || 
        (tool.name && tool.name.includes('pubmed'))
      );
      console.log(`🔍 DEBUG-LLM-SERVICE: Tools include pubmed: ${hasPubmedTool}`);
    }
    
    // If there's a toolChoice, log it
    if (debugOptions.toolChoice) {
      console.log(`🔍 DEBUG-LLM-SERVICE: Received toolChoice:`, JSON.stringify(debugOptions.toolChoice));
    }
    
    // Merge default options with request-specific options
    const mergedOptions = {
      ...this.options,
      ...options,
      systemPrompt
    };
    
    // Use type assertion for merged options as well
    const debugMergedOptions = mergedOptions as any;
    
    // Debug logging for merged options that will be sent to provider
    console.log(`🔍 DEBUG-LLM-SERVICE: Passing to provider:`, JSON.stringify({
      provider: this.options.provider,
      hasToolChoice: !!debugMergedOptions.toolChoice,
      hasTools: !!(debugMergedOptions.tools && Array.isArray(debugMergedOptions.tools) && debugMergedOptions.tools.length > 0)
    }));
    
    // Check cache if enabled
    if (this.options.cacheResponses && options.skipCache !== true) {
      const cachedResponse = this._cache.get(prompt, mergedOptions);
      if (cachedResponse) {
        console.log('LLMService: Cache hit');
        return cachedResponse;
      }
    }
    
    console.log(`LLMService: Sending query with format ${responseFormat || 'default'}`);
    
    // Ensure provider is initialized  
    if (!this.provider) {
      throw new Error('LLM provider not initialized. Call setProvider() first.');
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
        console.warn('LLMService: Response is not valid JSON. Attempting to extract JSON...');
        // Try to extract JSON from the response
        const extractedJSON = extractJSONFromText(processedContent);
        if (extractedJSON) {
          processedContent = extractedJSON;
          console.log('LLMService: Successfully extracted valid JSON from response');
        } else {
          console.error('LLMService: Failed to extract valid JSON from response');
        }
      }
    }
    
    const finalResponse: LLMResponse = {
      ...response,
      content: processedContent
    };
    
    // Cache response if caching is enabled
    if (this.options.cacheResponses) {
      this._cache.set(prompt, finalResponse, mergedOptions);
    }
    
    return finalResponse;
  }
  
  /**
   * Analyze data using the LLM
   * @param data The data to analyze
   * @param task The analysis task description
   * @param options Additional request options
   * @returns The LLM's analysis
   */
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
  
  /**
   * Rank items based on criteria
   * @param items The items to rank
   * @param criteria The ranking criteria
   * @param options Additional request options
   * @returns The ranked items
   */
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
      console.error('LLMService: Failed to parse ranked items:', error);
      throw new Error('Failed to parse ranked items JSON');
    }
  }
  
  /**
   * Extract structured JSON from a prompt
   * @param prompt The prompt that should return JSON
   * @param options Additional request options
   * @returns The parsed JSON object
   */
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
      console.error('LLMService: Failed to parse JSON response:', error);
      throw new Error('Failed to extract valid JSON from response');
    }
  }
  
  /**
   * Get the cache instance for direct operations
   * @returns The cache instance
   */
  get cache(): LLMCache {
    return this._cache;
  }
  
  /**
   * Get statistics about the service
   * @returns Service statistics
   */
  getStats() {
    return {
      provider: this.options.provider,
      model: this.options.model,
      cache: this._cache.getStats()
    };
  }
  
  /**
   * Update MCP servers configuration
   * @param mcpServers MCP servers configuration
   */
  async updateMCPServers(mcpServers: Record<string, unknown>): Promise<void> {
    // Type assertion for MCP servers configuration
    this.mcpServers = mcpServers as Record<string, MCPServerConfig>;
    
    // Update the provider with new MCP servers if it exists
    if (this.provider) {
      try {
        await this.provider.updateMCPServers(this.mcpServers);
        console.log(`✅ LLMService: Updated MCP servers configuration`);
      } catch (error) {
        console.error(`❌ LLMService: Error updating MCP servers:`, error);
      }
    }
  }
} 