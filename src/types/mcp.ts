export interface MCPMetadata {
  hasBinaryOutput?: boolean;
  binaryType?: string;
  sourceCode?: string;
}

export interface MCPContentItem {
  text: string;
  metadata?: MCPMetadata;
}

export interface MCPBinaryOutput {
  type: string;
  data: string;
  metadata: {
    sourceCode?: string;
  };
}

export interface MCPResponse {
  content: MCPContentItem[];
  binaryOutput?: MCPBinaryOutput;
  isError: boolean;
}
