import { v4 as uuidv4 } from 'uuid';

// Define types for the knowledge graph data structure
interface KnowledgeGraphNode {
  id: string;
  startingId?: string; // Original ID before normalization
  name: string;
  group: number;
  val?: number;
  color?: string;
  entityType?: string;
  metadata?: {
    label?: string;
    description?: string;
    type?: string[];
  };
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

// Define types for Node Normalizer API
interface NodeNormResponse {
  [curie: string]: {
    id: {
      identifier: string;
      label?: string;
      description?: string;
    };
    equivalent_identifiers?: Array<{
      identifier: string;
      label?: string;
      description?: string;
      type?: string;
    }>;
    type?: string[];
    information_content?: number;
  };
}

interface FormattedResult {
  content: {
    type: string;
    text: string;
  }[];
  artifacts?: KnowledgeGraphArtifact[];
}

// Helper function to check if a node ID should be filtered out
function shouldFilterNode(id: string): boolean {
  return id.startsWith('CAID:');
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
 * Call the Node Normalizer API to get canonical IDs for a list of CURIEs
 * Uses batching to avoid overwhelming the API
 * 
 * @param curies - Array of CURIEs to normalize
 * @returns A map of original CURIEs to their normalized data
 */
async function normalizeNodes(curies: string[]): Promise<Map<string, any>> {
  const BATCH_SIZE = 50;
  const DELAY_MS = 500; // 500ms delay between batches
  const NODE_NORM_API = 'https://nodenorm.ci.transltr.io/1.5/get_normalized_nodes';
  
  console.error(`MEDIK FORMATTER: Normalizing ${curies.length} nodes using Node Normalizer API`);
  console.error(`MEDIK FORMATTER: First few CURIEs to normalize: ${curies.slice(0, 5).join(', ')}${curies.length > 5 ? '...' : ''}`);
  
  // Create a map to store the normalized data
  const normalizedMap = new Map<string, any>();
  
  // Process in batches
  for (let i = 0; i < curies.length; i += BATCH_SIZE) {
    const batchCuries = curies.slice(i, i + BATCH_SIZE);
    console.error(`MEDIK FORMATTER: Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(curies.length/BATCH_SIZE)} (${batchCuries.length} nodes)`);
    
    try {
      // Build the URL with query parameters
      const url = new URL(NODE_NORM_API);
      batchCuries.forEach(curie => {
        url.searchParams.append('curie', curie);
      });
      url.searchParams.append('conflate', 'true');
      url.searchParams.append('drug_chemical_conflate', 'false');
      url.searchParams.append('description', 'true');
      url.searchParams.append('individual_types', 'true');
      
      console.error(`MEDIK FORMATTER: Making request to Node Normalizer API: ${url.toString().substring(0, 100)}...`);
      
      // Make the request
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`MEDIK FORMATTER: Error from Node Normalizer API: ${response.status} ${response.statusText}`);
        console.error(`MEDIK FORMATTER: Response body: ${await response.text()}`);
        continue;
      }
      
      const data: NodeNormResponse = await response.json();
      console.error(`MEDIK FORMATTER: Received response from Node Normalizer API with ${Object.keys(data).length} normalized nodes`);
      
      // Log a sample of the response
      const sampleKey = Object.keys(data)[0];
      if (sampleKey) {
        console.error(`MEDIK FORMATTER: Sample normalized data for ${sampleKey}:`, JSON.stringify(data[sampleKey], null, 2));
      }
      
      // Add the normalized data to the map
      for (const [curie, normData] of Object.entries(data)) {
        normalizedMap.set(curie, normData);
      }
      
      // Add a delay between batches to avoid overwhelming the API
      if (i + BATCH_SIZE < curies.length) {
        console.error(`MEDIK FORMATTER: Waiting ${DELAY_MS}ms before next batch`);
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    } catch (error) {
      console.error(`MEDIK FORMATTER: Error normalizing nodes: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`MEDIK FORMATTER: Error stack: ${error instanceof Error ? error.stack : 'No stack trace available'}`);
    }
  }
  
  console.error(`MEDIK FORMATTER: Successfully normalized ${normalizedMap.size} out of ${curies.length} nodes`);
  return normalizedMap;
}

/**
 * Formats mediKanren query results into human-readable text and a knowledge graph artifact
 * 
 * @param queryResults - The raw results from a mediKanren query
 * @param queryParams - The parameters used for the query (for context)
 * @returns A Promise that resolves to an object with content (text) and artifacts (knowledge graph)
 */
export function formatKnowledgeGraphArtifact(
  queryResults: any[],
  queryParams: { e1: string; e2: string; e3: string }
): Promise<FormattedResult & { filteredCount?: number; filteredNodeCount?: number }> {
  // Log the raw data before processing
  console.error(`MEDIK FORMATTER: Processing ${queryResults.length} raw results`);
  console.error(`MEDIK FORMATTER: Query params:`, JSON.stringify(queryParams, null, 2));
  
  // Sample the first few results to avoid excessive logging
  if (queryResults.length > 0) {
    console.error(`MEDIK FORMATTER: Sample of first result:`, JSON.stringify(queryResults[0], null, 2));
  }
  
  // Track unique CAID nodes that will be filtered out
  const caidNodes = new Set<string>();
  
  // First pass: identify all CAID nodes
  queryResults.forEach(result => {
    const [sourceId, , , targetId] = result;
    if (sourceId && shouldFilterNode(sourceId)) {
      caidNodes.add(sourceId);
    }
    if (targetId && shouldFilterNode(targetId)) {
      caidNodes.add(targetId);
    }
  });
  
  // Filter out results containing CAID: prefixed nodes
  const originalCount = queryResults.length;
  const filteredResults = queryResults.filter(result => {
    const [sourceId, , , targetId] = result;
    return !shouldFilterNode(sourceId) && !shouldFilterNode(targetId);
  });
  const filteredCount = originalCount - filteredResults.length;
  const filteredNodeCount = caidNodes.size;
  
  console.error(`MEDIK FORMATTER: After filtering: ${filteredResults.length} results remain (removed ${filteredCount} results with ${filteredNodeCount} unique CAID nodes)`);
  
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
  
  filteredResults.forEach(result => {
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
        startingId: sourceId, // Store the original ID
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
        startingId: targetId, // Store the original ID
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
  
  // Convert node map to array for normalization
  const nodes = Array.from(nodeMap.values());
  
  // Get all unique node IDs for normalization
  const nodeIds = nodes.map(node => node.id);
  
  // Normalize the nodes asynchronously and then continue processing
  return normalizeNodes(nodeIds).then(normalizedMap => {
    console.error(`MEDIK FORMATTER: Applying normalized IDs to ${nodes.length} nodes`);
    console.error(`MEDIK FORMATTER: Normalized map contains ${normalizedMap.size} entries`);
    
    // Track ID changes for updating links
    const idMap = new Map<string, string>();
    let normalizedCount = 0;
    
    // Apply normalized IDs to nodes
    nodes.forEach(node => {
      console.error(`MEDIK FORMATTER: Processing node ${node.id}`);
      const normData = normalizedMap.get(node.id);
      
      if (!normData) {
        console.error(`MEDIK FORMATTER: No normalized data found for ${node.id}`);
        return;
      }
      
      if (!normData.id) {
        console.error(`MEDIK FORMATTER: Normalized data for ${node.id} does not contain id field:`, JSON.stringify(normData, null, 2));
        return;
      }
      
      // Store the original ID for reference
      const originalId = node.id;
      
      // Update the node with normalized data
      node.startingId = originalId;
      node.id = normData.id.identifier;
      node.name = normData.id.label || node.name;
      node.metadata = {
        label: normData.id.label,
        description: normData.id.description,
        type: normData.type
      };
      
      // Track the ID change for updating links
      idMap.set(originalId, node.id);
      normalizedCount++;
      
      console.error(`MEDIK FORMATTER: Normalized ${originalId} to ${node.id}`);
    });
    
    console.error(`MEDIK FORMATTER: Successfully normalized ${normalizedCount} out of ${nodes.length} nodes`);
    console.error(`MEDIK FORMATTER: ID map contains ${idMap.size} entries`);
    
    // Update links with new node IDs
    let updatedLinkCount = 0;
    graph.links.forEach(link => {
      if (idMap.has(link.source)) {
        const oldSource = link.source;
        link.source = idMap.get(link.source)!;
        console.error(`MEDIK FORMATTER: Updated link source from ${oldSource} to ${link.source}`);
        updatedLinkCount++;
      }
      if (idMap.has(link.target)) {
        const oldTarget = link.target;
        link.target = idMap.get(link.target)!;
        console.error(`MEDIK FORMATTER: Updated link target from ${oldTarget} to ${link.target}`);
        updatedLinkCount++;
      }
    });
    
    console.error(`MEDIK FORMATTER: Updated ${updatedLinkCount} link endpoints`);
    
    // Update the graph with normalized nodes
    graph.nodes = nodes;
    
    // Log a sample of the final nodes
    if (graph.nodes.length > 0) {
      console.error(`MEDIK FORMATTER: Sample of final node:`, JSON.stringify(graph.nodes[0], null, 2));
    }
    
    console.error(`MEDIK FORMATTER: Created knowledge graph with ${graph.nodes.length} nodes and ${graph.links.length} links`);
    
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
    
    let humanReadableText = `
# Knowledge Graph: ${queryType} ${entityName} via ${relationshipType}

The graph includes the following relationships:
${formattedRelationships}

Identify any patterns or insights based solely on what the graph shows, and then offer your own insights such as other concepts that may be interesting to pursue based on the data and why.
`;

    // Add information about filtered nodes if any were filtered
    if (filteredCount > 0) {
      humanReadableText = `
# Knowledge Graph: ${queryType} ${entityName} via ${relationshipType}

Note: ${filteredCount} relationships involving ${filteredNodeCount} unique nodes with CAID: prefix were filtered out from the results. These CAID variants are typically less reliable or less established in the literature.

The graph includes the following relationships:
${formattedRelationships}

Identify any patterns or insights based solely on what the graph shows, and then offer your own insights such as other concepts that may be interesting to pursue based on the data and why.
`;
    }

    // Create the knowledge graph artifact
    const artifact: KnowledgeGraphArtifact = {
      type: 'application/vnd.knowledge-graph',
      title: `Knowledge Graph: ${queryType} ${entityName}`,
      content: JSON.stringify(graph)
    };
    
    console.error(`MEDIK FORMATTER: Completed formatting with ${relationships.length} relationships`);
    
    return {
      content: [
        {
          type: 'text',
          text: humanReadableText
        }
      ],
      artifacts: [artifact],
      filteredCount,
      filteredNodeCount
    };
  });
} 