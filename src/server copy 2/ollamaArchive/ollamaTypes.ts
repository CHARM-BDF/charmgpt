/**
 * Type definitions for Ollama server implementation
 */

// Basic message types
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Configuration types
export interface OllamaConfig {
  host: string;
  port?: number;
  fallbackPort?: number;
}

// Tool related types
export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: {
        [key: string]: {
          type: string;
          description: string;
          enum?: string[];
        };
      };
      required: string[];
    };
  };
}

// Response types
export interface ToolResponse {
  type: 'tool_use';
  name: string;
  input: {
    thinking?: string;
    conversation: Array<{
      type: 'text' | 'artifact';
      content?: string;
      metadata?: {
        hasBinaryOutput?: boolean;
        binaryType?: string;
        [key: string]: any;
      };
      artifact?: {
        type: string;
        id: string;
        title: string;
        content: string;
        language?: string;
      };
    }>;
  };
  binaryOutput?: {
    type: string;
    data: string;
    metadata: {
      size?: number;
      sourceCode?: string;
      [key: string]: any;
    };
  };
}

// Server response format
export interface ServerResponse {
  response: {
    thinking?: string;
    conversation: string;
    artifacts?: Array<{
      id: string;
      type: string;
      title: string;
      content: string;
      position: number;
      language?: string;
    }>;
  };
  error?: {
    message: string;
    details?: any;
  };
} 