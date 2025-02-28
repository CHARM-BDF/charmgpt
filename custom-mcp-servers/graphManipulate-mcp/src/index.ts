import { v4 as uuidv4 } from 'uuid';

// Store for conversation context (in a real implementation, this would be a database)
const conversationStore: Record<string, any[]> = {};

// Knowledge graph manipulation tool
const knowledgeGraphTool = {
  name: "knowledge_graph_manipulator",
  description: "Manipulate knowledge graphs by applying transformations like grouping, filtering, or highlighting",
  input_schema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["groupByProperty", "filterNodes", "highlightNodes", "resetView"],
        description: "The type of operation to perform on the graph"
      },
      targetGraphId: {
        type: "string",
        description: "ID of the graph artifact to manipulate"
      },
      params: {
        type: "object",
        description: "Parameters specific to the operation",
        properties: {
          propertyName: { type: "string" },
          predicate: { type: "string" },
          value: { type: "string" },
          nodeIds: { type: "array", items: { type: "string" } },
          color: { type: "string" }
        }
      }
    },
    required: ["operation", "targetGraphId"]
  }
};

// Find an artifact by ID in the conversation history
function findArtifactById(messages: any[], artifactId: string): any {
  // First check if any message has the artifact directly
  for (const message of messages) {
    if (message.role === 'assistant' && message.artifacts) {
      const artifact = message.artifacts.find((a: any) => a.id === artifactId);
      if (artifact) return artifact;
    }
  }
  
  // Then check if any message has a knowledgeGraph property
  for (const message of messages) {
    if (message.knowledgeGraph) {
      // If the message has a knowledge graph, check if it's the one we're looking for
      const graph = message.knowledgeGraph;
      if (graph.id === artifactId) return {
        id: artifactId,
        type: 'application/vnd.ant.knowledge-graph',
        content: JSON.stringify(graph)
      };
    }
  }
  
  // Finally check if any message has artifacts in its content
  for (const message of messages) {
    if (message.role === 'assistant' && Array.isArray(message.content)) {
      for (const content of message.content) {
        if (content.type === 'tool_use' && content.name === 'response_formatter') {
          const formatterResponse = content.input;
          if (formatterResponse.conversation) {
            for (const item of formatterResponse.conversation) {
              if (item.type === 'artifact' && item.artifact && item.artifact.id === artifactId) {
                return item.artifact;
              }
            }
          }
        }
      }
    }
  }
  
  return null;
}

// Handle knowledge graph manipulation
function handleGraphManipulation(input: any, conversationId: string): any {
  console.error(`Graph operation: ${input.operation}`);
  console.error(`Target graph ID: ${input.targetGraphId}`);
  console.error(`Params:`, JSON.stringify(input.params, null, 2));
  
  // Get conversation context
  const messages = conversationStore[conversationId] || [];
  
  const { operation, targetGraphId, params } = input;
  
  // Find the target artifact
  const targetArtifact = findArtifactById(messages, targetGraphId);
  
  if (!targetArtifact) {
    return {
      error: "Target graph not found",
      content: [{ type: 'text', text: "Error: Target graph not found" }]
    };
  }
  
  try {
    // Parse the current graph data
    const graphData = JSON.parse(targetArtifact.content);
    let updatedNodes, updatedLinks;
    
    // Apply the requested operation
    switch (operation) {
      case 'groupByProperty': {
        const { propertyName } = params;
        
        // Get unique values for the property
        const propertyValues = new Set();
        graphData.nodes.forEach((node: any) => {
          if (node[propertyName] !== undefined) {
            propertyValues.add(String(node[propertyName]));
          }
        });
        
        // Assign group numbers based on property values
        const valueToGroup: Record<string, number> = Array.from(propertyValues).reduce((acc: Record<string, number>, val: any, index: number) => {
          acc[val] = index + 1;
          return acc;
        }, {});
        
        // Update nodes with group information
        updatedNodes = graphData.nodes.map((node: any) => ({
          ...node,
          group: node[propertyName] !== undefined ? 
            valueToGroup[String(node[propertyName])] : 0
        }));
        
        break;
      }
      
      case 'highlightNodes': {
        const { nodeIds, color = '#ff0000' } = params;
        
        // Update nodes with highlighting
        updatedNodes = graphData.nodes.map((node: any) => ({
          ...node,
          color: nodeIds.includes(node.id) ? color : (node.color || null)
        }));
        
        break;
      }
      
      case 'filterNodes': {
        const { predicate, value } = params;
        
        // Filter nodes based on the predicate and value
        const filteredNodeIds = new Set(
          graphData.nodes
            .filter((node: any) => node[predicate] === value)
            .map((node: any) => node.id)
        );
        
        // Keep only nodes that match the filter
        updatedNodes = graphData.nodes.map((node: any) => ({
          ...node,
          hidden: !filteredNodeIds.has(node.id)
        }));
        
        // Keep only links that connect visible nodes
        updatedLinks = graphData.links.map((link: any) => ({
          ...link,
          hidden: !filteredNodeIds.has(link.source) || !filteredNodeIds.has(link.target)
        }));
        
        break;
      }
      
      case 'resetView': {
        // Reset all visual properties
        updatedNodes = graphData.nodes.map((node: any) => {
          const { color, group, hidden, ...rest } = node;
          return rest;
        });
        
        updatedLinks = graphData.links.map((link: any) => {
          const { hidden, ...rest } = link;
          return rest;
        });
        
        break;
      }
      
      default:
        return {
          error: `Unsupported operation: ${operation}`,
          content: [{ type: 'text', text: `Error: Unsupported operation: ${operation}` }]
        };
    }
    
    // Create a new version of the graph
    const newGraph = {
      ...graphData,
      nodes: updatedNodes || graphData.nodes,
      links: updatedLinks || graphData.links,
      metadata: {
        ...graphData.metadata,
        version: (graphData.metadata?.version || 0) + 1,
        previousVersion: targetArtifact.id,
        commandHistory: [
          ...(graphData.metadata?.commandHistory || []),
          {
            command: operation,
            params: params,
            timestamp: new Date().toISOString()
          }
        ]
      }
    };
    
    // Create a new artifact with the updated graph
    const newArtifactId = uuidv4();
    const newArtifact = {
      id: newArtifactId,
      artifactId: newArtifactId,
      type: 'application/vnd.ant.knowledge-graph',
      title: `${targetArtifact.title || 'Knowledge Graph'} (v${newGraph.metadata.version})`,
      content: JSON.stringify(newGraph),
      previousVersionId: targetArtifact.id,
      versionNumber: newGraph.metadata.version,
      versionLabel: `Applied ${operation}`,
      versionTimestamp: new Date(),
      graphMetadata: {
        nodeCount: newGraph.nodes.length,
        edgeCount: newGraph.links.length,
        lastCommand: operation,
        commandParams: params
      }
    };
    
    // Store the new artifact in the conversation context
    if (!conversationStore[conversationId]) {
      conversationStore[conversationId] = [];
    }
    
    // Add a message with the new artifact
    conversationStore[conversationId].push({
      role: 'assistant',
      artifacts: [newArtifact]
    });
    
    // Return the result
    return {
      content: [{ 
        type: 'text', 
        text: `Successfully applied ${operation} to the knowledge graph.` 
      }],
      artifacts: [newArtifact]
    };
    
  } catch (error: any) {
    console.error('Error manipulating knowledge graph:', error);
    return { 
      error: `Error manipulating knowledge graph: ${error.message}`,
      content: [{ 
        type: 'text', 
        text: `Error manipulating knowledge graph: ${error.message}` 
      }]
    };
  }
}

// Store conversation context
function storeConversation(conversationId: string, messages: any[]): any {
  conversationStore[conversationId] = messages;
  return { success: true };
}

// Handle incoming messages from stdin
process.stdin.setEncoding('utf-8');
let inputBuffer = '';

process.stdin.on('data', (chunk) => {
  inputBuffer += chunk;
  
  // Try to parse complete JSON messages
  try {
    const message = JSON.parse(inputBuffer);
    inputBuffer = ''; // Clear buffer after successful parse
    
    // Process the message
    if (message.type === 'list_tools') {
      // Return available tools
      const response = {
        id: message.id,
        tools: [knowledgeGraphTool]
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    } 
    else if (message.type === 'execute_tool') {
      // Execute the requested tool
      if (message.tool === 'knowledge_graph_manipulator') {
        const result = handleGraphManipulation(message.input, message.conversation_id || 'default');
        const response = {
          id: message.id,
          ...result
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      } 
      else {
        // Unknown tool
        const response = {
          id: message.id,
          error: `Unknown tool: ${message.tool}`,
          content: [{ type: 'text', text: `Error: Unknown tool: ${message.tool}` }]
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    }
    else if (message.type === 'store_conversation') {
      // Store conversation context
      const result = storeConversation(message.conversation_id, message.messages);
      const response = {
        id: message.id,
        ...result
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    }
    else {
      // Unknown message type
      const response = {
        id: message.id,
        error: `Unknown message type: ${message.type}`,
        content: [{ type: 'text', text: `Error: Unknown message type: ${message.type}` }]
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  } catch (error) {
    // If we can't parse the message yet, wait for more data
    if (!(error instanceof SyntaxError)) {
      console.error('Error processing message:', error);
    }
  }
});

// Log startup message
console.error('GraphManipulate MCP Server running on stdio'); 