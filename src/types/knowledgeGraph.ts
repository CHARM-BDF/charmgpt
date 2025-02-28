// Define the types for our knowledge graph data
export interface KnowledgeGraphNode {
  id: string;
  name: string;
  group?: number;
  val?: number; // Optional size value
  color?: string; // Optional color
  [key: string]: any; // Allow for additional properties
}

export interface KnowledgeGraphLink {
  source: string;
  target: string;
  value?: number;
  label?: string;
  color?: string;
  [key: string]: any; // Allow for additional properties
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
  
  // Version tracking metadata
  metadata?: {
    version?: number;
    previousVersion?: string;
    commandHistory?: Array<{
      command: string;
      params: Record<string, any>;
      timestamp: string;
    }>;
  };
}

// Graph command types
export type GraphCommandType = 
  | 'groupByProperty' 
  | 'filterNodes' 
  | 'highlightNodes'
  | 'expandNode'
  | 'collapseNode'
  | 'focusSubgraph'
  | 'resetView';

export interface GraphCommand {
  type: GraphCommandType;
  targetGraphId: string;
  params: Record<string, any>;
} 