/**
 * LLM Service Type Definitions
 * 
 * This file contains the core interfaces and types for the LLM Service.
 */

/**
 * Configuration options for the LLM Service
 */
export interface LLMServiceOptions {
  /** The LLM provider to use ('anthropic' is currently the only supported provider) */
  provider?: 'anthropic';
  /** The model to use (defaults to claude-3-5-sonnet-20241022) */
  model?: string;
  /** Temperature setting for controlling randomness (0.0 to 1.0) */
  temperature?: number;
  /** Maximum tokens to generate in the response */
  maxTokens?: number;
  /** Whether to cache responses (defaults to true) */
  cacheResponses?: boolean;
  /** Skip cache lookup for this request (defaults to false) */
  skipCache?: boolean;
}

/**
 * Request parameters for an LLM query
 */
export interface LLMRequest {
  /** The prompt to send to the LLM */
  prompt: string;
  /** Optional system prompt to guide the LLM's behavior */
  systemPrompt?: string;
  /** Desired format of the response */
  responseFormat?: 'json' | 'text' | 'markdown';
  /** Additional context data that might be used by the service */
  contextData?: Record<string, any>;
  /** Override default service options for this request */
  options?: Partial<LLMServiceOptions>;
}

/**
 * Response from an LLM query
 */
export interface LLMResponse {
  /** The content returned by the LLM */
  content: string;
  /** The raw response from the provider (useful for debugging) */
  rawResponse?: any;
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
 * Provider-specific options for LLM calls
 */
export interface LLMProviderOptions extends Partial<LLMServiceOptions> {
  /** API key for the provider (optional, can be set in environment variables) */
  apiKey?: string;
  /** System prompt to guide the LLM's behavior */
  systemPrompt?: string;
}

/**
 * Response from an LLM provider before processing
 */
export interface LLMProviderResponse {
  /** The content returned by the provider */
  content: string;
  /** The raw response from the provider */
  rawResponse: any;
  /** Token usage information */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Interface that all LLM providers must implement
 */
export interface LLMProvider {
  /** 
   * Send a query to the LLM provider
   * @param prompt The prompt to send
   * @param options Provider-specific options
   * @returns The provider's response
   */
  query(prompt: string, options?: LLMProviderOptions): Promise<LLMProviderResponse>;
}

/**
 * Event data for tracking LLM usage
 */
export interface LLMUsageEvent {
  /** The provider used for this request */
  provider: string;
  /** The model used for this request */
  model: string;
  /** Token usage information */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Whether this response was retrieved from cache */
  cached?: boolean;
  /** Name of the MCP that made the request */
  mcpName?: string;
  /** Format of the response */
  responseFormat?: string;
}

/**
 * Main LLM Service interface
 */
export interface LLMService {
  /** 
   * Send a query to the LLM 
   * @param request The request parameters
   * @returns The processed response
   */
  query(request: LLMRequest): Promise<LLMResponse>;
  
  /**
   * Analyze data using the LLM
   * @param data The data to analyze
   * @param task The analysis task description
   * @param options Additional request options
   * @returns The LLM's analysis
   */
  analyze(data: any, task: string, options?: Partial<LLMRequest>): Promise<LLMResponse>;
  
  /**
   * Rank items based on criteria
   * @param items The items to rank
   * @param criteria The ranking criteria
   * @param options Additional request options
   * @returns The ranked items
   */
  rank<T extends any[]>(items: T, criteria: string, options?: Partial<LLMRequest>): Promise<T>;
  
  /**
   * Extract structured JSON from a prompt
   * @param prompt The prompt that should return JSON
   * @param options Additional request options
   * @returns The parsed JSON object
   */
  extractJSON<T>(prompt: string, options?: Partial<LLMRequest>): Promise<T>;
} 