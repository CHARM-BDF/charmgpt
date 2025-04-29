/**
 * LLM Service Implementation
 * 
 * This file implements the main LLM Service that provides centralized
 * access to LLM capabilities for all MCP servers.
 */

import { AnthropicProvider } from './providers/anthropic';
import { LLMCache } from './cache';
import { isValidJSON, extractJSONFromText } from './utils';
import { 
  LLMService as LLMServiceInterface,
  LLMServiceOptions,
  LLMRequest,
  LLMResponse,
  LLMProvider
} from './types';

/**
 * Main implementation of the LLM Service
 */
export class LLMService implements LLMServiceInterface {
  /** LLM provider instance */
  private provider: LLMProvider;
  /** Cache for LLM responses */
  private _cache: LLMCache;
  /** Service configuration */
  private options: LLMServiceOptions;
  
  /**
   * Create a new LLM Service
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
    
    console.log(`LLMService: Initializing with provider ${this.options.provider}, model ${this.options.model}`);
    
    // Initialize provider
    if (this.options.provider === 'anthropic') {
      this.provider = new AnthropicProvider({
        model: this.options.model
      });
    } else {
      throw new Error(`Unsupported LLM provider: ${this.options.provider}`);
    }
    
    // Initialize cache
    this._cache = new LLMCache();
    
    console.log('LLMService: Initialization complete');
  }
  
  /**
   * Send a query to the LLM
   * @param request The request parameters
   * @returns The processed response
   */
  async query(request: LLMRequest): Promise<LLMResponse> {
    const { prompt, systemPrompt, responseFormat, contextData, options = {} } = request;
    
    // Merge default options with request-specific options
    const mergedOptions = {
      ...this.options,
      ...options,
      systemPrompt
    };
    
    // Check cache if enabled
    if (this.options.cacheResponses && options.skipCache !== true) {
      const cachedResponse = this._cache.get(prompt, mergedOptions);
      if (cachedResponse) {
        console.log('LLMService: Cache hit');
        return cachedResponse;
      }
    }
    
    console.log(`LLMService: Sending query with format ${responseFormat || 'default'}`);
    
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
} 