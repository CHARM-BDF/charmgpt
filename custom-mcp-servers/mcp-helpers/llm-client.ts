/**
 * LLM Client for MCP Servers
 * 
 * This file provides a client library for MCP servers to interact with 
 * the centralized LLM Service.
 */

import fetch from 'node-fetch';
// Remove the timers/promises import and define our own delay function

/**
 * Create a delay using Promise
 * @param ms Time to delay in milliseconds
 * @returns Promise that resolves after ms milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface LLMClientOptions {
  /** Base URL for the LLM Service (defaults to http://localhost:3000/api/internal/llm) */
  baseUrl?: string;
  /** Request timeout in milliseconds (defaults to 30000) */
  timeout?: number;
  /** Authentication token (defaults to MCP_AUTH_TOKEN environment variable) */
  authToken?: string;
  /** Number of retries for failed requests (defaults to 3) */
  retries?: number;
  /** Name of the MCP for logging purposes */
  mcpName?: string;
}

interface LLMQueryParams {
  /** The prompt to send to the LLM */
  prompt: string;
  /** Optional system prompt to guide the LLM's behavior */
  systemPrompt?: string;
  /** Desired format of the response */
  responseFormat?: 'json' | 'text' | 'markdown';
  /** Additional context data that might be used by the service */
  contextData?: Record<string, any>;
  /** Additional options for the LLM */
  options?: Record<string, any>;
}

interface LLMResponse {
  /** Whether the request was successful */
  success: boolean;
  /** The content returned by the LLM */
  content: string;
  /** Error message if the request failed */
  error?: string;
  /** Token usage information */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Whether this response was retrieved from cache */
  cached?: boolean;
}

/**
 * Client for the LLM Service
 */
export class LLMClient {
  private baseUrl: string;
  private timeout: number;
  private authToken: string;
  private retries: number;
  private mcpName: string;
  
  /**
   * Create a new LLM client
   * @param options Client configuration options
   */
  constructor(options: LLMClientOptions = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3001/api/internal/llm';
    this.timeout = options.timeout || 30000;
    this.authToken = options.authToken || process.env.MCP_AUTH_TOKEN || '';
    this.retries = options.retries || 3;
    this.mcpName = options.mcpName || 'unknown-mcp';
    
    console.log(`LLMClient: Initialized with baseUrl ${this.baseUrl}`);
  }
  
  /**
   * Send a request to the LLM Service
   * @param endpoint The endpoint to call
   * @param body The request body
   * @param retryCount Current retry count (internal use)
   * @returns The response from the LLM Service
   */
  private async sendRequest(endpoint: string, body: any, retryCount = 0): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      console.log(`LLMClient: Sending request to ${endpoint}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Auth': this.authToken,
          'X-MCP-Name': this.mcpName
        },
        body: JSON.stringify(body),
        signal: controller.signal as any // Type assertion to fix compatibility issue
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM Service request failed: ${response.status} ${errorText}`);
      }
      
      return await response.json();
    } catch (error: any) { // Type annotation to fix 'unknown' error
      // Handle abort errors
      if (error.name === 'AbortError') {
        throw new Error(`LLM Service request timed out after ${this.timeout}ms`);
      }
      
      // Retry on network errors
      if (retryCount < this.retries) {
        console.warn(`LLMClient: Request failed, retrying (${retryCount + 1}/${this.retries})...`);
        const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
        await delay(backoffTime); // Use our custom delay function
        return this.sendRequest(endpoint, body, retryCount + 1);
      }
      
      // Max retries exceeded
      throw error;
    }
  }
  
  /**
   * Send a query to the LLM
   * @param params The query parameters
   * @returns The response from the LLM
   */
  async query(params: LLMQueryParams): Promise<LLMResponse> {
    try {
      return await this.sendRequest('/query', params);
    } catch (error: any) { // Type annotation to fix 'unknown' error
      console.error('LLMClient: Query failed:', error);
      return {
        success: false,
        content: '',
        error: error.message || 'Unknown error'
      };
    }
  }
  
  /**
   * Analyze data using the LLM
   * @param data The data to analyze
   * @param task The analysis task description
   * @param options Additional request options
   * @returns The LLM's analysis
   */
  async analyze(data: any, task: string, options = {}): Promise<LLMResponse> {
    try {
      return await this.sendRequest('/analyze', { data, task, options });
    } catch (error: any) { // Type annotation to fix 'unknown' error
      console.error('LLMClient: Analysis failed:', error);
      return {
        success: false,
        content: '',
        error: error.message || 'Unknown error'
      };
    }
  }
  
  /**
   * Rank items based on criteria
   * @param items The items to rank
   * @param criteria The ranking criteria
   * @param options Additional request options
   * @returns The ranked items or original items if ranking failed
   */
  async rank<T extends any[]>(items: T, criteria: string, options = {}): Promise<T> {
    try {
      const result = await this.sendRequest('/rank', { items, criteria, options });
      return result.success ? result.items : items;
    } catch (error) {
      console.error('LLMClient: Ranking failed:', error);
      // Return original items unranked if the request fails
      return items;
    }
  }
}

export default LLMClient; 