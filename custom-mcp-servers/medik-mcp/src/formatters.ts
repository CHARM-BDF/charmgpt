import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

// Add workspace root path resolution
const workspaceRoot = process.cwd();
const logsDir = path.join(workspaceRoot, 'logs', 'data');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log(`MEDIK FORMATTER: Created logs directory at ${logsDir}`);
}

// Define types for the knowledge graph data structure
interface KnowledgeGraphNode {
  id: string;
  startingId?: string[]; // Array of original IDs before normalization
  name: string;
  group: number;
  val?: number;
  color?: string;
  entityType?: string;
  isStartingNode?: boolean;
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
  filteredCount?: number;
  filteredNodeCount?: number;
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

/**
 * Determine entity type from biolink types
 * @param types Array of biolink types
 * @returns A human-readable entity type
 */
function getEntityTypeFromBiolink(types: string[] | undefined): string {
  if (!types || types.length === 0) {
    return 'Other';
  }
  
  // Check for cellular component
  if (types.includes('biolink:CellularComponent')) {
    return 'Cellular Component';
  }
  
  // Check for chemical entities
  if (types.includes('biolink:SmallMolecule') || 
      types.includes('biolink:ChemicalEntity') || 
      types.includes('biolink:ChemicalOrDrugOrTreatment')) {
    return 'Chemical';
  }
  
  // Check for anatomical structures
  if (types.includes('biolink:GrossAnatomicalStructure') || 
      types.includes('biolink:AnatomicalEntity')) {
    return 'Anatomical Structure';
  }
  
  // Check for genes and proteins
  if (types.includes('biolink:Gene') || 
      types.includes('biolink:GeneOrGeneProduct') || 
      types.includes('biolink:Protein') || 
      types.includes('biolink:GeneProductMixin') || 
      types.includes('biolink:Polypeptide')) {
    return 'Gene';
  }
  
  // Check for gene families and groups
  if (types.includes('biolink:GeneFamily') || 
      types.includes('biolink:GeneGroupingMixin')) {
    return 'Gene Group';
  }
  
  // Check for diseases and phenotypes
  if (types.includes('biolink:Disease') ||
      types.includes('biolink:DiseaseOrPhenotypicFeature') ||
      types.includes('biolink:PhenotypicFeature') ||
      types.includes('biolink:Disease')) {
    return 'Disease or Phenotype';
  }
  
  // Default case
  return 'Other';
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
  
  console.log(`MEDIK FORMATTER: Normalizing ${curies.length} nodes`);
  
  // Create a map to store the normalized data
  const normalizedMap = new Map<string, any>();
  
  // Process in batches
  for (let i = 0; i < curies.length; i += BATCH_SIZE) {
    const batchCuries = curies.slice(i, i + BATCH_SIZE);
    
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
      
      console.log(`MEDIK FORMATTER: Making request to: ${url.toString()}`);
      
      // Make the request
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.log(`MEDIK FORMATTER: Error from Node Normalizer API: ${response.status} ${response.statusText}`);
        continue;
      }
      
      const data: NodeNormResponse = await response.json();
      console.log(`MEDIK FORMATTER: Received ${Object.keys(data).length} normalized nodes`);
      
      // Add the normalized data to the map, filtering out null values
      for (const [curie, normData] of Object.entries(data)) {
        if (normData !== null) {
          normalizedMap.set(curie, normData);
        }
      }
      
      // Add a delay between batches to avoid overwhelming the API
      if (i + BATCH_SIZE < curies.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    } catch (error) {
      console.log(`MEDIK FORMATTER: Error normalizing nodes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  console.log(`MEDIK FORMATTER: Successfully normalized ${normalizedMap.size} out of ${curies.length} nodes`);
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
  queryParams: { e1: string; e2: string; e3: string },
  startingNodeIds?: Set<string>
): Promise<FormattedResult & { filteredCount?: number; filteredNodeCount?: number }> {
  // Create timestamp and filename base
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const searchTerm = queryParams.e3.replace(/[^a-zA-Z0-9]/g, '_');
  const fileBase = `${timestamp}_${searchTerm}`;
  
  // Save raw data with absolute path
  try {
    const rawDataPath = path.join(logsDir, `${fileBase}_raw.json`);
    fs.writeFileSync(rawDataPath, JSON.stringify({
      queryParams,
      results: queryResults
    }, null, 2));
    console.log(`MEDIK FORMATTER: Saved raw data to ${rawDataPath}`);
  } catch (error) {
    console.log(`MEDIK FORMATTER: Error saving raw data: ${error}`);
    console.log(`MEDIK FORMATTER: Current working directory: ${process.cwd()}`);
    console.log(`MEDIK FORMATTER: Attempted to save to: ${logsDir}`);
  }

  // Log the raw data before processing
  console.log(`MEDIK FORMATTER: Processing ${queryResults.length} raw results`);
  console.log(`MEDIK FORMATTER: Query params:`, JSON.stringify(queryParams, null, 2));
  
  // Sample the first few results to avoid excessive logging
  if (queryResults.length > 0) {
    console.log(`MEDIK FORMATTER: Sample of first result:`, JSON.stringify(queryResults[0], null, 2));
  }
  
  // Track unique CAID nodes that will be filtered out
  const caidNodes = new Set<string>();
  
  // Initialize the knowledge graph structure
  const graph: KnowledgeGraph = {
    nodes: [],
    links: []
  };
  
  // Track unique nodes to avoid duplicates
  const nodeMap = new Map<string, KnowledgeGraphNode>();
  
  // Track node connections for sizing
  const connectionCounts = new Map<string, number>();
  
  // First pass: identify all CAID nodes
  queryResults.forEach(result => {
    const [sourceId, sourceName, predicate, targetId, targetName, _, evidence] = result;
    
    // Helper function to process IDs
    const processId = (id: string) => {
      // Check if it's a UniProtKB ID with version
      if (id.startsWith('UniProtKB:') && id.includes('-')) {
        const [baseId] = id.split('-');
        return baseId; // Return unversioned ID for normalization
      }
      return id;
    };
    
    if (sourceId) {
      const normalizedId = processId(sourceId);
      if (normalizedId !== sourceId) {
        // If this is a versioned ID, update the node in nodeMap
        const node = nodeMap.get(sourceId);
        if (node) {
          nodeMap.set(normalizedId, {
            ...node,
            id: normalizedId,
            startingId: [sourceId] // Keep the versioned ID in startingId
          });
          nodeMap.delete(sourceId); // Remove the old entry
        }
      }
      if (shouldFilterNode(sourceId)) {
        caidNodes.add(sourceId);
      }
    }
    
    if (targetId) {
      const normalizedId = processId(targetId);
      if (normalizedId !== targetId) {
        // If this is a versioned ID, update the node in nodeMap
        const node = nodeMap.get(targetId);
        if (node) {
          nodeMap.set(normalizedId, {
            ...node,
            id: normalizedId,
            startingId: [targetId] // Keep the versioned ID in startingId
          });
          nodeMap.delete(targetId); // Remove the old entry
        }
      }
      if (shouldFilterNode(targetId)) {
        caidNodes.add(targetId);
      }
    }
  });
  
  // Filter out results containing CAID: prefixed nodes and transcribed_from edges
  const originalCount = queryResults.length;
  const filteredResults = queryResults.filter(result => {
    const [sourceId, , predicate, targetId] = result;
    
    // Filter out CAID nodes
    if (shouldFilterNode(sourceId) || shouldFilterNode(targetId)) {
      return false;
    }
    
    // Filter out transcribed_from edges
    if (predicate === 'transcribed_from') {
      console.log(`MEDIK FORMATTER: Filtering out transcribed_from edge: ${sourceId} -> ${targetId}`);
      return false;
    }
    
    return true;
  });
  
  const filteredCount = originalCount - filteredResults.length;
  const filteredNodeCount = caidNodes.size;
  
  console.log(`MEDIK FORMATTER: After filtering: ${filteredResults.length} results remain (removed ${filteredCount} results)`);
  
  // Process each result triple
  const relationships: string[] = [];
  
  filteredResults.forEach(result => {
    const [sourceId, sourceName, predicate, targetId, targetName, _, evidence] = result;
    
    // Skip if missing essential data
    if (!sourceId || !sourceName || !predicate || !targetId || !targetName) {
      return;
    }
    
    // Helper function to process IDs
    const processId = (id: string) => {
      // Check if it's a UniProtKB ID with version
      if (id.startsWith('UniProtKB:') && id.includes('-')) {
        const [baseId] = id.split('-');
        return baseId; // Return unversioned ID for normalization
      }
      return id;
    };

    // Add human-readable relationship
    const readablePredicate = formatPredicate(predicate);
    relationships.push(`${sourceName} ${readablePredicate} ${targetName}`);
    
    // Process source node
    const sourceNormalizedId = processId(sourceId);
    if (!nodeMap.has(sourceNormalizedId)) {
      const { type, group } = getEntityTypeAndGroup(sourceId);
      nodeMap.set(sourceNormalizedId, {
        id: sourceNormalizedId,
        startingId: [sourceId], // Store the original versioned ID
        name: sourceName,
        group,
        entityType: type,
        isStartingNode: startingNodeIds?.has(sourceId) // Set starting node flag
      });
    } else if (sourceId !== sourceNormalizedId) {
      // If this is a different version of the same node, add to startingId
      const existingNode = nodeMap.get(sourceNormalizedId)!;
      if (!existingNode.startingId) {
        existingNode.startingId = [sourceId];
      } else if (!existingNode.startingId.includes(sourceId)) {
        existingNode.startingId.push(sourceId);
      }
      // Preserve starting node status if this version is a starting node
      if (startingNodeIds?.has(sourceId)) {
        existingNode.isStartingNode = true;
      }
    }
    
    // Process target node
    const targetNormalizedId = processId(targetId);
    if (!nodeMap.has(targetNormalizedId)) {
      const { type, group } = getEntityTypeAndGroup(targetId);
      nodeMap.set(targetNormalizedId, {
        id: targetNormalizedId,
        startingId: [targetId], // Store the original versioned ID
        name: targetName,
        group,
        entityType: type,
        isStartingNode: startingNodeIds?.has(targetId) // Set starting node flag
      });
    } else if (targetId !== targetNormalizedId) {
      // If this is a different version of the same node, add to startingId
      const existingNode = nodeMap.get(targetNormalizedId)!;
      if (!existingNode.startingId) {
        existingNode.startingId = [targetId];
      } else if (!existingNode.startingId.includes(targetId)) {
        existingNode.startingId.push(targetId);
      }
      // Preserve starting node status if this version is a starting node
      if (startingNodeIds?.has(targetId)) {
        existingNode.isStartingNode = true;
      }
    }
    
    // Update connection counts
    connectionCounts.set(sourceNormalizedId, (connectionCounts.get(sourceNormalizedId) || 0) + 1);
    connectionCounts.set(targetNormalizedId, (connectionCounts.get(targetNormalizedId) || 0) + 1);
    
    // Add link using normalized IDs
    graph.links.push({
      source: sourceNormalizedId,
      target: targetNormalizedId,
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
    // console.log(`MEDIK FORMATTER: Applying normalized IDs to ${nodes.length} nodes`);
    // console.log(`MEDIK FORMATTER: Normalized map contains ${normalizedMap.size} entries`);
    
    // Track ID changes for updating links
    const idMap = new Map<string, string>();
    let normalizedCount = 0;
    
    // Track nodes that have been merged
    const mergedNodes = new Map<string, KnowledgeGraphNode>();
    
    // First pass: Apply normalized IDs to nodes and identify duplicates
    nodes.forEach(node => {
      console.log(`MEDIK FORMATTER: Processing node ${node.id}`);
      const normData = normalizedMap.get(node.id);
      
      if (!normData) {
        console.log(`MEDIK FORMATTER: No normalized data found for ${node.id}`);
        return;
      }
      
      if (!normData.id) {
        console.log(`MEDIK FORMATTER: Normalized data for ${node.id} does not contain id field:`, JSON.stringify(normData, null, 2));
        return;
      }
      
      // Store the original ID for reference
      const originalId = node.id;
      const normalizedId = normData.id.identifier;
      
      // Track the ID change for updating links
      idMap.set(originalId, normalizedId);
      
      // Check if we've already seen this normalized ID
      if (mergedNodes.has(normalizedId)) {
        // This is a duplicate, merge with existing node
        const existingNode = mergedNodes.get(normalizedId)!;
        
        // Add the original ID to the startingId array of the existing node
        if (node.startingId && node.startingId.length > 0) {
          // Ensure we don't add duplicate startingIds
          const newStartingIds = node.startingId.filter(id => !existingNode.startingId?.includes(id));
          existingNode.startingId = [...(existingNode.startingId || []), ...newStartingIds];
        } else {
          // If no startingId array, use the original ID
          const originalId = node.id;
          if (!existingNode.startingId?.includes(originalId)) {
            existingNode.startingId = [...(existingNode.startingId || []), originalId];
          }
        }
        
        // Preserve isStartingNode property - if either node is a starting node, the merged node should be too
        existingNode.isStartingNode = existingNode.isStartingNode || node.isStartingNode;
        
        // Update connection count (will be used for node size)
        existingNode.val = (existingNode.val || 0) + (node.val || 0);
        
        console.log(`MEDIK FORMATTER: Merged node ${node.id} into existing node ${normalizedId} with startingIds: ${existingNode.startingId?.join(', ')}`);
      } else {
        // This is a new normalized ID
        // Update the node with normalized data
        node.id = normalizedId;
        node.name = normData.id.label || node.name;
        
        // Ensure startingId is an array
        if (!Array.isArray(node.startingId)) {
          node.startingId = node.startingId ? [node.startingId] : [originalId];
        }
        
        // Determine entity type from biolink types if available
        const biolinkEntityType = getEntityTypeFromBiolink(normData.type);
        
        // Update node metadata and entity type
        node.metadata = {
          label: normData.id.label,
          description: normData.id.description,
          type: normData.type
        };
        
        // Update entity type with biolink-derived type
        node.entityType = biolinkEntityType;
        
        // Preserve isStartingNode property
        node.isStartingNode = node.isStartingNode || false;
        
        // Add to merged nodes map
        mergedNodes.set(normalizedId, node);
        normalizedCount++;
        
        console.log(`MEDIK FORMATTER: Normalized ${originalId} to ${normalizedId}`);
      }
    });
    
    console.log(`MEDIK FORMATTER: Successfully normalized to ${mergedNodes.size} unique nodes from ${nodes.length} original nodes`);
    console.log(`MEDIK FORMATTER: ID map contains ${idMap.size} entries`);
    
    // Update links with new node IDs
    let updatedLinkCount = 0;
    graph.links.forEach(link => {
      if (idMap.has(link.source)) {
        const oldSource = link.source;
        link.source = idMap.get(link.source)!;
        console.log(`MEDIK FORMATTER: Updated link source from ${oldSource} to ${link.source}`);
        updatedLinkCount++;
      }
      if (idMap.has(link.target)) {
        const oldTarget = link.target;
        link.target = idMap.get(link.target)!;
        console.log(`MEDIK FORMATTER: Updated link target from ${oldTarget} to ${link.target}`);
        updatedLinkCount++;
      }
    });
    
    console.log(`MEDIK FORMATTER: Updated ${updatedLinkCount} link endpoints`);
    
    // Update the graph with merged nodes
    graph.nodes = Array.from(mergedNodes.values());
    
    // Ensure all nodes have colors and startingId arrays
    graph.nodes.forEach(node => {
      // Make sure startingId is an array
      if (!node.startingId) {
        node.startingId = [node.id];
        console.log(`MEDIK FORMATTER: Fixed missing startingId for node ${node.id}`);
      } else if (!Array.isArray(node.startingId)) {
        node.startingId = [node.startingId];
        console.log(`MEDIK FORMATTER: Converted startingId to array for node ${node.id}`);
      }
    });
    
    // Log the final nodes after ensuring colors and startingId arrays
    console.log(`MEDIK FORMATTER: Final nodes after ensuring colors and startingId arrays:`);
    graph.nodes.slice(0, 3).forEach((node, index) => {
      console.log(`MEDIK FORMATTER: Node ${index + 1}:`, JSON.stringify({
        id: node.id,
        name: node.name,
        entityType: node.entityType,
        startingId: node.startingId
      }, null, 2));
    });
    
    // Log a sample of the final nodes
    if (graph.nodes.length > 0) {
      console.log(`MEDIK FORMATTER: Sample of final node:`, JSON.stringify(graph.nodes[0], null, 2));
    }
    
    // Final verification that all nodes have colors
    const nodesWithoutColor = graph.nodes.filter(node => !node.color);
    if (nodesWithoutColor.length > 0) {
      console.log(`MEDIK FORMATTER: WARNING - Found ${nodesWithoutColor.length} nodes without color property. Fixing...`);
      nodesWithoutColor.forEach(node => {
        // Just log that we're skipping color assignment as it's now handled by templates
        console.log(`MEDIK FORMATTER: Node ${node.id} has no color - will be handled by templates`);
      });
    } else {
      console.log(`MEDIK FORMATTER: All nodes have required properties. Good!`);
    }
    
    // Final check before returning the graph
    console.log(`MEDIK FORMATTER: Performing final verification of node properties before returning graph...`);
    const finalNodeCheck = graph.nodes.map(node => {
      // Create a deep copy to avoid modifying the original
      const nodeCopy = { ...node };
      
      // Ensure startingId is an array
      if (!nodeCopy.startingId) {
        nodeCopy.startingId = [nodeCopy.id];
        console.log(`MEDIK FORMATTER: Final check - Fixed missing startingId for node ${nodeCopy.id}`);
      } else if (!Array.isArray(nodeCopy.startingId)) {
        nodeCopy.startingId = [nodeCopy.startingId];
        console.log(`MEDIK FORMATTER: Final check - Converted startingId to array for node ${nodeCopy.id}`);
      }
      
      return nodeCopy;
    });
    
    // Replace the nodes with the verified ones
    graph.nodes = finalNodeCheck;
    
    // Log the final graph structure
    console.log(`MEDIK FORMATTER: Final graph structure - ${graph.nodes.length} nodes and ${graph.links.length} links`);
    if (graph.nodes.length > 0) {
      console.log(`MEDIK FORMATTER: First node in final graph:`, JSON.stringify({
        id: graph.nodes[0].id,
        name: graph.nodes[0].name,
        entityType: graph.nodes[0].entityType,
        startingId: graph.nodes[0].startingId
      }, null, 2));
    }
    
    // Create human-readable text
    const queryType = queryParams.e1 === 'X->Known' ? 'entities related to' : 
                      queryParams.e1 === 'Bidirectional' ? 'all entities related to' : 
                      'entities that relate to';
    const entityName = queryParams.e1 === 'X->Known' || queryParams.e1 === 'Bidirectional' ? 
                      queryParams.e3 : 
                      queryParams.e1;
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

${queryParams.e1 === 'Bidirectional' ? 'This is a comprehensive bidirectional query that includes both incoming and outgoing relationships.\nBoth forward and reverse queries were successful - no need to run this query again.\n\n' : ''}The graph includes the following relationships:
${formattedRelationships}

Identify any patterns or insights based solely on what the graph shows, and then offer your own insights such as other concepts that may be interesting to pursue based on the data and why.
`;

    // Add information about filtered nodes if any were filtered
    if (filteredCount > 0) {
      humanReadableText = `
# Knowledge Graph: ${queryType} ${entityName} via ${relationshipType}

${queryParams.e1 === 'Bidirectional' ? 'This is a comprehensive bidirectional query that includes both incoming and outgoing relationships.\nBoth forward and reverse queries were successful - no need to run this query again.\n\n' : ''}Note: ${filteredCount} relationships were filtered out from the results:
- Relationships involving ${filteredNodeCount} unique nodes with CAID: prefix (these variants are typically less reliable or less established in the literature)
- Edges with the 'transcribed_from' predicate (these represent basic transcription relationships)

The graph includes the following relationships:
${formattedRelationships}

Identify any patterns or insights based solely on what the graph shows, and then offer your own insights such as other concepts that may be interesting to pursue based on the data and why.
`;
    }

    // Create the knowledge graph artifact
    const artifact: KnowledgeGraphArtifact = {
      type: 'application/vnd.knowledge-graph',
      title: queryParams.e1 === 'Bidirectional' 
        ? `Knowledge Graph: All relationships for ${entityName}`
        : `Knowledge Graph: ${queryType} ${entityName}`,
      content: JSON.stringify(graph)
    };
    
    console.log(`MEDIK FORMATTER: Completed formatting with ${relationships.length} relationships`);
    
    // Before returning, save the formatted data with absolute path
    try {
      const formattedDataPath = path.join(logsDir, `${fileBase}_formatted.json`);
      fs.writeFileSync(formattedDataPath, JSON.stringify({
        graph,
        relationships,
        content: humanReadableText,
        stats: {
          originalCount,
          filteredCount,
          filteredNodeCount,
          finalNodeCount: graph.nodes.length,
          finalLinkCount: graph.links.length
        }
      }, null, 2));
      console.log(`MEDIK FORMATTER: Saved formatted data to ${formattedDataPath}`);
    } catch (error) {
      console.log(`MEDIK FORMATTER: Error saving formatted data: ${error}`);
      console.log(`MEDIK FORMATTER: Current working directory: ${process.cwd()}`);
      console.log(`MEDIK FORMATTER: Attempted to save to: ${logsDir}`);
    }

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

/**
 * Formats the network neighborhood for a group of genes/proteins
 * 
 * @param queryResults - Combined results from bidirectional queries
 * @param startCuries - Array of starting CURIEs (genes/proteins)
 * @returns A Promise that resolves to an object with content (text) and artifacts (knowledge graph)
 */
export function formatNetworkNeighborhood(
  queryResults: any[],
  startCuries: string[]
): Promise<FormattedResult> {
  const startingNodeIds = new Set(startCuries);
  
  // Track which nodes are connected to which starting nodes
  const nodeConnections = new Map<string, Set<string>>();
  
  // Process each result to build connections map
  queryResults.forEach(result => {
    const [sourceId, sourceName, predicate, targetId, targetName] = result;
    
    // Skip if missing essential data
    if (!sourceId || !targetId) {
      return;
    }
    
    // If source is a starting node, record that target is connected to it
    if (startingNodeIds.has(sourceId)) {
      if (!nodeConnections.has(targetId)) {
        nodeConnections.set(targetId, new Set());
      }
      nodeConnections.get(targetId)!.add(sourceId);
    }
    
    // If target is a starting node, record that source is connected to it
    if (startingNodeIds.has(targetId)) {
      if (!nodeConnections.has(sourceId)) {
        nodeConnections.set(sourceId, new Set());
      }
      nodeConnections.get(sourceId)!.add(targetId);
    }
  });
  
  // Filter results to keep only:
  // 1. Relationships between starting nodes
  // 2. Relationships to nodes connected to 2+ starting nodes
  const filteredResults = queryResults.filter(result => {
    const [sourceId, sourceName, predicate, targetId, targetName] = result;
    
    // Always keep relationships between starting nodes
    if (startingNodeIds.has(sourceId) && startingNodeIds.has(targetId)) {
      return true;
    }
    
    // Keep if source is a starting node and target is connected to 2+ starting nodes
    if (startingNodeIds.has(sourceId) && 
        nodeConnections.has(targetId) && 
        nodeConnections.get(targetId)!.size >= 2) {
      return true;
    }
    
    // Keep if target is a starting node and source is connected to 2+ starting nodes
    if (startingNodeIds.has(targetId) && 
        nodeConnections.has(sourceId) && 
        nodeConnections.get(sourceId)!.size >= 2) {
      return true;
    }
    
    // Otherwise, filter it out
    return false;
  });
  
  // Use the existing formatKnowledgeGraphArtifact function with modified parameters
  return formatKnowledgeGraphArtifact(filteredResults, {
    e1: "NetworkNeighborhood",
    e2: "network-connections",
    e3: startCuries.join(',')
  }, startingNodeIds); // Pass the starting node IDs to formatKnowledgeGraphArtifact
} 