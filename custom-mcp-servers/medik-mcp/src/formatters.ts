import { v4 as uuidv4 } from 'uuid';

// Define types for the knowledge graph data structure
interface KnowledgeGraphNode {
  id: string;
  name: string;
  group: number;
  val?: number;
  color?: string;
  entityType?: string;
}

interface KnowledgeGraphLink {
  source: string;
  target: string;
  value?: number;
  label: string;
  color?: string;
  evidence?: string[];
}

interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
}

interface KnowledgeGraphArtifact {
  type: string;
  title: string;
  content: string; // JSON stringified graph data
}

interface FormattedResult {
  content: {
    type: string;
    text: string;
  }[];
  artifacts?: KnowledgeGraphArtifact[];
}

// Helper function to determine entity type and group from ID
function getEntityTypeAndGroup(id: string): { type: string; group: number } {
  if (id.startsWith('DRUGBANK:')) {
    return { type: 'Drug', group: 1 };
  } else if (id.startsWith('NCBIGene:')) {
    return { type: 'Gene', group: 2 };
  } else if (id.startsWith('MONDO:') || id.startsWith('HP:') || id.startsWith('DOID:')) {
    return { type: 'Disease', group: 3 };
  } else if (id.startsWith('UMLS:')) {
    return { type: 'UMLS Concept', group: 4 };
  } else if (id.startsWith('REACT:')) {
    return { type: 'Reaction', group: 5 };
  } else if (id.startsWith('NCIT:')) {
    return { type: 'Cancer Concept', group: 6 };
  } else {
    return { type: 'Other', group: 7 };
  }
}

// Helper function to make predicate human-readable
function formatPredicate(predicate: string): string {
  // Remove the biolink: prefix
  let formatted = predicate.replace('biolink:', '');
  
  // Replace underscores with spaces
  formatted = formatted.replace(/_/g, ' ');
  
  return formatted;
}

/**
 * Formats mediKanren query results into human-readable text and a knowledge graph artifact
 * 
 * @param queryResults - The raw results from a mediKanren query
 * @param queryParams - The parameters used for the query (for context)
 * @returns An object with content (text) and artifacts (knowledge graph)
 */
export function formatKnowledgeGraphArtifact(
  queryResults: any[],
  queryParams: { e1: string; e2: string; e3: string }
): FormattedResult {
  // Initialize the knowledge graph structure
  const graph: KnowledgeGraph = {
    nodes: [],
    links: []
  };
  
  // Track unique nodes to avoid duplicates
  const nodeMap = new Map<string, KnowledgeGraphNode>();
  
  // Track node connections for sizing
  const connectionCounts = new Map<string, number>();
  
  // Process each result triple
  const relationships: string[] = [];
  
  queryResults.forEach(result => {
    // Extract the relevant parts of the triple
    const [sourceId, sourceName, predicate, targetId, targetName, _, evidence] = result;
    
    // Skip if missing essential data
    if (!sourceId || !sourceName || !predicate || !targetId || !targetName) {
      return;
    }
    
    // Add human-readable relationship
    const readablePredicate = formatPredicate(predicate);
    relationships.push(`${sourceName} ${readablePredicate} ${targetName}`);
    
    // Process source node
    if (!nodeMap.has(sourceId)) {
      const { type, group } = getEntityTypeAndGroup(sourceId);
      nodeMap.set(sourceId, {
        id: sourceId,
        name: sourceName,
        group,
        entityType: type
      });
    }
    
    // Process target node
    if (!nodeMap.has(targetId)) {
      const { type, group } = getEntityTypeAndGroup(targetId);
      nodeMap.set(targetId, {
        id: targetId,
        name: targetName,
        group,
        entityType: type
      });
    }
    
    // Update connection counts
    connectionCounts.set(sourceId, (connectionCounts.get(sourceId) || 0) + 1);
    connectionCounts.set(targetId, (connectionCounts.get(targetId) || 0) + 1);
    
    // Add link
    graph.links.push({
      source: sourceId,
      target: targetId,
      label: readablePredicate,
      value: 1,
      evidence: Array.isArray(evidence) ? evidence : []
    });
  });
  
  // Update node sizes based on connection counts
  nodeMap.forEach((node, id) => {
    const connections = connectionCounts.get(id) || 1;
    node.val = Math.max(5, Math.min(20, connections * 3)); // Scale node size between 5 and 20
  });
  
  // Convert node map to array
  graph.nodes = Array.from(nodeMap.values());
  
  // Create human-readable text
  const queryType = queryParams.e1 === 'X->Known' ? 'entities related to' : 'entities that relate to';
  const entityName = queryParams.e1 === 'X->Known' ? queryParams.e3 : queryParams.e1;
  const relationshipType = formatPredicate(queryParams.e2);
  
  // Group relationships by predicate for better readability
  const groupedRelationships = relationships.reduce((acc, rel) => {
    const parts = rel.split(' ');
    const predicate = parts.slice(1, -1).join(' ');
    if (!acc[predicate]) {
      acc[predicate] = [];
    }
    acc[predicate].push(rel);
    return acc;
  }, {} as Record<string, string[]>);
  
  // Format the grouped relationships
  const formattedRelationships = Object.entries(groupedRelationships)
    .map(([predicate, rels]) => {
      return `\n### ${predicate.toUpperCase()}\n${rels.map(r => `- ${r}`).join('\n')}`;
    })
    .join('\n');
  
  const humanReadableText = `
# Knowledge Graph: ${queryType} ${entityName} via ${relationshipType}

The graph includes the following relationships:
${formattedRelationships}

Identify any patterns or insights based solely on what the graph shows, and then offer your own insights such as other concepts that may be interesting to pursue based on the data and why.
`;

  // Create the knowledge graph artifact
  const artifact: KnowledgeGraphArtifact = {
    type: 'application/vnd.knowledge-graph',
    title: `Knowledge Graph: ${queryType} ${entityName}`,
    content: JSON.stringify(graph)
  };
  
  return {
    content: [
      {
        type: 'text',
        text: humanReadableText
      }
    ],
    artifacts: [artifact]
  };
} 