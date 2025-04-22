/**
 * Standard interfaces for MCP (Model Context Protocol) responses and artifacts
 * Used to standardize data transfer between MCP servers and the chat server
 */

/**
 * Standard MCP content item
 * Represents a single piece of text content returned from an MCP server
 */
export interface MCPContentItem {
  /** Content type (usually "text") */
  type: string;
  
  /** Text content */
  text: string;
  
  /** Whether this content is intended for the model (not for display to user) */
  forModel?: boolean;
}

/**
 * Standard MCP artifact
 * Represents a structured piece of data like a bibliography, knowledge graph, or image
 */
export interface MCPArtifact {
  /** MIME type of the artifact */
  type: string;
  
  /** Display title for the artifact */
  title: string;
  
  /** Content - either a string or a serializable object */
  content: any;
  
  /** Optional language for code artifacts */
  language?: string;
}

/**
 * Standard MCP response metadata
 * Additional information about query execution, results, etc.
 */
export interface MCPResponseMetadata {
  /** Whether the query was successful */
  querySuccess?: boolean;
  
  /** Count of nodes in a graph response */
  nodeCount?: number;
  
  /** Human-readable message about the response */
  message?: string;
  
  /** Flag indicating if both directions were queried for bidirectional operations */
  bothDirectionsSuccessful?: boolean;
  
  /** Any additional metadata fields */
  [key: string]: any;
}

/**
 * Standardized MCP server response
 * All MCP servers should return responses in this format
 */
export interface StandardMCPResponse {
  /** Array of content items for the chat interface */
  content: MCPContentItem[];
  
  /** Optional array of structured artifacts */
  artifacts?: MCPArtifact[];
  
  /** Optional metadata about the response */
  metadata?: MCPResponseMetadata;
  
  /** @deprecated Use artifacts instead - Legacy field for bibliography data */
  bibliography?: any[];
  
  /** @deprecated Use artifacts instead - Legacy field for grant markdown */
  grantMarkdown?: string;
  
  /** @deprecated Use artifacts instead - Legacy field for knowledge graph */
  knowledgeGraph?: any;
  
  /** @deprecated Use artifacts instead - Legacy field for binary output */
  binaryOutput?: any;
}

/**
 * Binary output from an MCP server
 */
export interface MCPBinaryOutput {
  /** MIME type of the binary data */
  type: string;
  
  /** Base64 encoded binary data */
  data: string;
  
  /** Additional metadata */
  metadata: {
    /** Size in bytes */
    size?: number;
    
    /** Source code that generated the binary output */
    sourceCode?: string;
    
    /** Any additional metadata */
    [key: string]: any;
  };
}
