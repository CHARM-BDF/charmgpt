import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

// Add workspace root path resolution
const workspaceRoot = process.cwd();
const logsDir = path.join(workspaceRoot, 'logs', 'data');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.error(`MEDIK FORMATTER: Created logs directory at ${logsDir}`);
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
  
  // Default case
  return 'Other';
}

/**
 * Get a color for a specific entity type
 * @param entityType The entity type
 * @returns A hex color code
 */
function getColorForEntityType(entityType: string): string {
  // Define a color mapping for entity types
  const colorMap: Record<string, string> = {
    'Gene': '#4285F4',           // Google Blue
    'Gene Group': '#34A853',     // Google Green
    'Chemical': '#FBBC05',       // Google Yellow
    'Disease': '#EA4335',        // Google Red
    'Cellular Component': '#8E24AA', // Purple
    'Anatomical Structure': '#00ACC1', // Cyan
    'Drug': '#FB8C00',           // Orange
    'UMLS Concept': '#9E9E9E',   // Gray
    'Cancer Concept': '#D81B60', // Pink
    'Reaction': '#43A047',       // Green
    'Other': '#757575'           // Dark Gray
  };
  
  return colorMap[entityType] || colorMap['Other'];
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
      
      // Add the normalized data to the map, filtering out null values
      for (const [curie, normData] of Object.entries(data)) {
        if (normData === null) {
          console.error(`MEDIK FORMATTER: Node Normalizer returned null for ${curie}, will keep original node data`);
          // Don't add null values to the map - this will make normalizedMap.get() return undefined
          // which is already handled in the node processing logic
          continue;
        }
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
    console.error(`MEDIK FORMATTER: Saved raw data to ${rawDataPath}`);
  } catch (error) {
    console.error(`MEDIK FORMATTER: Error saving raw data: ${error}`);
    console.error(`MEDIK FORMATTER: Current working directory: ${process.cwd()}`);
    console.error(`MEDIK FORMATTER: Attempted to save to: ${logsDir}`);
  }

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
        startingId: [sourceId], // Store the original ID as an array
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
        startingId: [targetId], // Store the original ID as an array
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
    
    // Track nodes that have been merged
    const mergedNodes = new Map<string, KnowledgeGraphNode>();
    
    // First pass: Apply normalized IDs to nodes and identify duplicates
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
      const normalizedId = normData.id.identifier;
      
      // Track the ID change for updating links
      idMap.set(originalId, normalizedId);
      
      // Check if we've already seen this normalized ID
      if (mergedNodes.has(normalizedId)) {
        // This is a duplicate, merge with existing node
        const existingNode = mergedNodes.get(normalizedId)!;
        
        // Add the original ID to the startingId array of the existing node
        if (node.startingId && node.startingId.length > 0) {
          existingNode.startingId = [...(existingNode.startingId || []), ...node.startingId];
        } else {
          existingNode.startingId = [...(existingNode.startingId || []), originalId];
        }
        
        // Update connection count (will be used for node size)
        existingNode.val = (existingNode.val || 0) + (node.val || 0);
        
        // Preserve color if it exists on the node being merged
        if (node.color && !existingNode.color) {
          existingNode.color = node.color;
          console.error(`MEDIK FORMATTER: Copied color ${node.color} from merged node ${originalId} to ${normalizedId}`);
        }
        
        // If the node being merged has an entity type but the existing node doesn't, copy it
        if (node.entityType && !existingNode.entityType) {
          existingNode.entityType = node.entityType;
          console.error(`MEDIK FORMATTER: Copied entity type ${node.entityType} from merged node ${originalId} to ${normalizedId}`);
          
          // Set color based on entity type if not already set
          if (!existingNode.color) {
            existingNode.color = getColorForEntityType(existingNode.entityType);
            console.error(`MEDIK FORMATTER: Set color ${existingNode.color} based on entity type ${existingNode.entityType} for merged node ${normalizedId}`);
          }
        }
        
        console.error(`MEDIK FORMATTER: Merged node ${originalId} into existing node ${normalizedId}`);
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
        
        // Assign color based on entity type
        node.color = getColorForEntityType(biolinkEntityType);
        
        // Log the entity type determination and color
        console.error(`MEDIK FORMATTER: Determined entity type for ${node.id}: ${biolinkEntityType} (color: ${node.color}) (from ${normData.type?.slice(0, 3).join(', ')}${normData.type && normData.type.length > 3 ? '...' : ''})`);
        
        // Add to merged nodes map
        mergedNodes.set(normalizedId, node);
        normalizedCount++;
        
        console.error(`MEDIK FORMATTER: Normalized ${originalId} to ${normalizedId}`);
      }
    });
    
    console.error(`MEDIK FORMATTER: Successfully normalized to ${mergedNodes.size} unique nodes from ${nodes.length} original nodes`);
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
    
    // Update the graph with merged nodes
    graph.nodes = Array.from(mergedNodes.values());
    
    // Ensure all nodes have colors and startingId arrays
    graph.nodes.forEach(node => {
      // Make sure startingId is an array
      if (!node.startingId) {
        node.startingId = [node.id];
        console.error(`MEDIK FORMATTER: Fixed missing startingId for node ${node.id}`);
      } else if (!Array.isArray(node.startingId)) {
        node.startingId = [node.startingId];
        console.error(`MEDIK FORMATTER: Converted startingId to array for node ${node.id}`);
      }
      
      // Make sure color is set based on entity type
      if (!node.color && node.entityType) {
        node.color = getColorForEntityType(node.entityType);
        console.error(`MEDIK FORMATTER: Added missing color for node ${node.id} based on entity type ${node.entityType}: ${node.color}`);
      } else if (!node.color) {
        // If no entity type, use the group to determine a color
        const entityType = node.group === 1 ? 'Drug' :
                          node.group === 2 ? 'Gene' :
                          node.group === 3 ? 'Disease' :
                          node.group === 4 ? 'UMLS Concept' :
                          node.group === 5 ? 'Reaction' :
                          node.group === 6 ? 'Cancer Concept' : 'Other';
        node.color = getColorForEntityType(entityType);
        console.error(`MEDIK FORMATTER: Added missing color for node ${node.id} based on group ${node.group}: ${node.color}`);
      }
    });
    
    // Log the final nodes after ensuring colors and startingId arrays
    console.error(`MEDIK FORMATTER: Final nodes after ensuring colors and startingId arrays:`);
    graph.nodes.slice(0, 3).forEach((node, index) => {
      console.error(`MEDIK FORMATTER: Node ${index + 1}:`, JSON.stringify({
        id: node.id,
        name: node.name,
        entityType: node.entityType,
        color: node.color,
        startingId: node.startingId
      }, null, 2));
    });
    
    // Log a sample of the final nodes
    if (graph.nodes.length > 0) {
      console.error(`MEDIK FORMATTER: Sample of final node:`, JSON.stringify(graph.nodes[0], null, 2));
    }
    
    // Final verification that all nodes have colors
    const nodesWithoutColor = graph.nodes.filter(node => !node.color);
    if (nodesWithoutColor.length > 0) {
      console.error(`MEDIK FORMATTER: WARNING - Found ${nodesWithoutColor.length} nodes without color property. Fixing...`);
      nodesWithoutColor.forEach(node => {
        // Determine color based on entity type or group
        if (node.entityType) {
          node.color = getColorForEntityType(node.entityType);
        } else {
          const entityType = node.group === 1 ? 'Drug' :
                            node.group === 2 ? 'Gene' :
                            node.group === 3 ? 'Disease' :
                            node.group === 4 ? 'UMLS Concept' :
                            node.group === 5 ? 'Reaction' :
                            node.group === 6 ? 'Cancer Concept' : 'Other';
          node.color = getColorForEntityType(entityType);
        }
        console.error(`MEDIK FORMATTER: Fixed missing color for node ${node.id}: ${node.color}`);
      });
    } else {
      console.error(`MEDIK FORMATTER: All nodes have color property. Good!`);
    }
    
    // Final check before returning the graph
    console.error(`MEDIK FORMATTER: Performing final verification of node properties before returning graph...`);
    const finalNodeCheck = graph.nodes.map(node => {
      // Create a deep copy to avoid modifying the original
      const nodeCopy = { ...node };
      
      // Ensure startingId is an array
      if (!nodeCopy.startingId) {
        nodeCopy.startingId = [nodeCopy.id];
        console.error(`MEDIK FORMATTER: Final check - Fixed missing startingId for node ${nodeCopy.id}`);
      } else if (!Array.isArray(nodeCopy.startingId)) {
        nodeCopy.startingId = [nodeCopy.startingId];
        console.error(`MEDIK FORMATTER: Final check - Converted startingId to array for node ${nodeCopy.id}`);
      }
      
      // Ensure color is set
      if (!nodeCopy.color) {
        if (nodeCopy.entityType) {
          nodeCopy.color = getColorForEntityType(nodeCopy.entityType);
          console.error(`MEDIK FORMATTER: Final check - Added missing color for node ${nodeCopy.id} based on entity type ${nodeCopy.entityType}: ${nodeCopy.color}`);
        } else {
          nodeCopy.color = getColorForEntityType('Other');
          console.error(`MEDIK FORMATTER: Final check - Added default color for node ${nodeCopy.id} with no entity type: ${nodeCopy.color}`);
        }
      }
      
      return nodeCopy;
    });
    
    // Replace the nodes with the verified ones
    graph.nodes = finalNodeCheck;
    
    // Log the final graph structure
    console.error(`MEDIK FORMATTER: Final graph structure - ${graph.nodes.length} nodes and ${graph.links.length} links`);
    if (graph.nodes.length > 0) {
      console.error(`MEDIK FORMATTER: First node in final graph:`, JSON.stringify({
        id: graph.nodes[0].id,
        name: graph.nodes[0].name,
        entityType: graph.nodes[0].entityType,
        color: graph.nodes[0].color,
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

${queryParams.e1 === 'Bidirectional' ? 'This is a comprehensive bidirectional query that includes both incoming and outgoing relationships.\n\n' : ''}The graph includes the following relationships:
${formattedRelationships}

Identify any patterns or insights based solely on what the graph shows, and then offer your own insights such as other concepts that may be interesting to pursue based on the data and why.
`;

    // Add information about filtered nodes if any were filtered
    if (filteredCount > 0) {
      humanReadableText = `
# Knowledge Graph: ${queryType} ${entityName} via ${relationshipType}

${queryParams.e1 === 'Bidirectional' ? 'This is a comprehensive bidirectional query that includes both incoming and outgoing relationships.\n\n' : ''}Note: ${filteredCount} relationships involving ${filteredNodeCount} unique nodes with CAID: prefix were filtered out from the results. These CAID variants are typically less reliable or less established in the literature.

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
    
    console.error(`MEDIK FORMATTER: Completed formatting with ${relationships.length} relationships`);
    
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
      console.error(`MEDIK FORMATTER: Saved formatted data to ${formattedDataPath}`);
    } catch (error) {
      console.error(`MEDIK FORMATTER: Error saving formatted data: ${error}`);
      console.error(`MEDIK FORMATTER: Current working directory: ${process.cwd()}`);
      console.error(`MEDIK FORMATTER: Attempted to save to: ${logsDir}`);
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