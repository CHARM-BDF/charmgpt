/**
 * Knowledge Graph utilities for merging and processing knowledge graph data
 */

export interface KnowledgeGraphNode {
  id: string;
  name: string;
  group?: number;
  entityType?: string;
  val?: number;
  [key: string]: any;
}

export interface KnowledgeGraphLink {
  source: string;
  target: string;
  label?: string;
  value?: number;
  evidence?: string[];
  [key: string]: any;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
  metadata?: {
    title?: string;
    description?: string;
    source?: string;
    timestamp?: string;
    [key: string]: any;
  };
}

/**
 * Merges two knowledge graphs, deduplicating nodes and links
 * 
 * @param graph1 - First knowledge graph
 * @param graph2 - Second knowledge graph
 * @returns Merged knowledge graph with deduplicated nodes and links
 */
export function mergeKnowledgeGraphs(graph1: KnowledgeGraph, graph2: KnowledgeGraph): KnowledgeGraph {
  // Create maps for nodes and links to enable efficient lookups
  const nodeMap = new Map<string, KnowledgeGraphNode>();
  const linkMap = new Map<string, KnowledgeGraphLink>();
  
  // Process nodes from first graph
  graph1.nodes.forEach(node => {
    nodeMap.set(node.id, node);
  });
  
  // Process nodes from second graph (adding only if new)
  graph2.nodes.forEach(node => {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, node);
    }
  });
  
  // Process links from first graph
  graph1.links.forEach(link => {
    const linkKey = `${link.source}|${link.target}|${link.label || ''}`;
    linkMap.set(linkKey, link);
  });
  
  // Process links from second graph
  graph2.links.forEach(link => {
    const linkKey = `${link.source}|${link.target}|${link.label || ''}`;
    
    if (!linkMap.has(linkKey)) {
      // New link, add it
      linkMap.set(linkKey, link);
    } else {
      // Existing link, merge evidence if available
      const existingLink = linkMap.get(linkKey)!;
      
      if (link.evidence && existingLink.evidence) {
        // Create a Set to deduplicate evidence
        const evidenceSet = new Set([...existingLink.evidence]);
        
        // Add new evidence
        link.evidence.forEach(item => evidenceSet.add(item));
        
        // Update evidence array
        existingLink.evidence = Array.from(evidenceSet);
      }
    }
  });
  
  // Merge metadata if present
  const metadata = {
    ...(graph1.metadata || {}),
    ...(graph2.metadata || {})
  };
  
  // Convert maps back to arrays for the final graph structure
  return {
    nodes: Array.from(nodeMap.values()),
    links: Array.from(linkMap.values()),
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined
  };
}

/**
 * Validates if an object is a properly formatted knowledge graph
 * 
 * @param obj - Object to validate
 * @returns Boolean indicating if the object is a valid knowledge graph
 */
export function isValidKnowledgeGraph(obj: any): obj is KnowledgeGraph {
  if (!obj || typeof obj !== 'object') return false;
  
  // Check if nodes array exists and contains valid nodes
  if (!Array.isArray(obj.nodes)) return false;
  if (obj.nodes.some((node: any) => !node.id || typeof node.id !== 'string')) return false;
  
  // Check if links array exists and contains valid links
  if (!Array.isArray(obj.links)) return false;
  if (obj.links.some((link: any) => 
    !link.source || typeof link.source !== 'string' || 
    !link.target || typeof link.target !== 'string'
  )) return false;
  
  return true;
} 