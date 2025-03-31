import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { v4 as uuidv4 } from 'uuid';

// Add startup timestamp
// console.error(`GraphManipulate MCP Server starting at ${new Date().toISOString()}`);

// Add process info logging
// console.error(`Process ID: ${process.pid}, Node version: ${process.version}`);
// console.error(`Working directory: ${process.cwd()}`);

// Store for conversation context (in a real implementation, this would be a database)
const conversationStore: Record<string, any[]> = {};

// Define validation schemas for the graph manipulation tool
const GraphManipulationSchema = z.object({
  operation: z.enum(["groupByProperty", "filterNodes", "highlightNodes", "resetView"])
    .describe("The type of operation to perform on the graph"),
  targetGraphId: z.string()
    .describe("ID of the graph artifact to manipulate"),
  params: z.object({
    propertyName: z.string().optional()
      .describe("Property name to group by (for groupByProperty operation)"),
    predicate: z.string().optional()
      .describe("Property to filter on (for filterNodes operation)"),
    value: z.string().optional()
      .describe("Value to filter by (for filterNodes operation)"),
    nodeIds: z.array(z.string()).optional()
      .describe("IDs of nodes to highlight (for highlightNodes operation)"),
    color: z.string().optional()
      .describe("Color to use for highlighting (for highlightNodes operation)")
  }).optional()
});

// Create server instance
const server = new Server(
  {
    name: "graph-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      logging: {}  // Add logging capability
    },
  }
);

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
async function handleGraphManipulation(input: z.infer<typeof GraphManipulationSchema>, conversationId: string): Promise<any> {
  console.error(`handleGraphManipulation started at ${new Date().toISOString()}`);
  console.error(`Operation: ${input.operation}, Target Graph ID: ${input.targetGraphId}`);
  
  try {
    // Only send logging messages if we're connected
    server.sendLoggingMessage({
      level: "info",
      data: {
        message: "Starting graph manipulation",
        operation: input.operation,
        targetGraphId: input.targetGraphId,
        params: input.params
      },
    });
  } catch (error) {
    console.error("Failed to send logging message, continuing anyway:", error);
  }
  
  // Get conversation context
  console.error(`Retrieving conversation context for ID: ${conversationId}`);
  const messages = conversationStore[conversationId] || [];
  console.error(`Found ${messages.length} messages in conversation context`);
  
  const { operation, targetGraphId, params } = input;
  
  // Find the target artifact
  console.error(`Looking for artifact with ID: ${targetGraphId}`);
  const targetArtifact = findArtifactById(messages, targetGraphId);
  
  if (!targetArtifact) {
    console.error(`Target artifact not found: ${targetGraphId}`);
    return {
      content: [{ 
        type: 'text', 
        text: "Error: Target graph not found" 
      }]
    };
  }
  
  console.error(`Found target artifact: ${targetArtifact.id}, type: ${targetArtifact.type}`);
  
  try {
    // Parse the current graph data
    console.error(`Parsing graph data from artifact content`);
    const graphData = JSON.parse(targetArtifact.content);
    console.error(`Graph data parsed successfully. Nodes: ${graphData.nodes?.length || 0}, Links: ${graphData.links?.length || 0}`);
    
    let updatedNodes, updatedLinks;
    
    // Apply the requested operation
    console.error(`Applying operation: ${operation}`);
    switch (operation) {
      case 'groupByProperty': {
        const propertyName = params?.propertyName;
        if (!propertyName) {
          return {
            content: [{ 
              type: 'text', 
              text: "Error: propertyName is required for groupByProperty operation" 
            }]
          };
        }
        
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
        const nodeIds = params?.nodeIds || [];
        const color = params?.color || '#ff0000';
        
        // Update nodes with highlighting
        updatedNodes = graphData.nodes.map((node: any) => ({
          ...node,
          color: nodeIds.includes(node.id) ? color : (node.color || null)
        }));
        
        break;
      }
      
      case 'filterNodes': {
        const predicate = params?.predicate;
        const value = params?.value;
        
        if (!predicate || value === undefined) {
          return {
            content: [{ 
              type: 'text', 
              text: "Error: predicate and value are required for filterNodes operation" 
            }]
          };
        }
        
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
          content: [{ 
            type: 'text', 
            text: `Error: Unsupported operation: ${operation}` 
          }]
        };
    }
    
    // Create a new version of the graph
    console.error(`Creating new version of the graph`);
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
    console.error(`Creating new artifact for the updated graph`);
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
    console.error(`Storing new artifact in conversation context`);
    if (!conversationStore[conversationId]) {
      conversationStore[conversationId] = [];
    }
    
    // Add a message with the new artifact
    conversationStore[conversationId].push({
      role: 'assistant',
      artifacts: [newArtifact]
    });
    
    console.error(`Graph manipulation completed successfully at ${new Date().toISOString()}`);
    
    // Return the result
    return {
      content: [{ 
        type: 'text', 
        text: `Successfully applied ${operation} to the knowledge graph.` 
      }],
      artifacts: [newArtifact]
    };
    
  } catch (error: any) {
    console.error(`Error in handleGraphManipulation: ${error.message}`);
    if (error.stack) {
      console.error(`Stack trace: ${error.stack}`);
    }
    
    try {
      server.sendLoggingMessage({
        level: "error",
        data: {
          message: "Error manipulating knowledge graph",
          error: error.message,
          stack: error.stack
        },
      });
    } catch (loggingError) {
      console.error("Failed to send error logging message:", loggingError);
    }
    
    return { 
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

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "knowledge_graph_manipulator",
        description: "Manipulate knowledge graphs by applying transformations like grouping, filtering, or highlighting",
        inputSchema: {
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
                propertyName: { 
                  type: "string",
                  description: "Property name to group by (for groupByProperty operation)"
                },
                predicate: { 
                  type: "string",
                  description: "Property to filter on (for filterNodes operation)"
                },
                value: { 
                  type: "string",
                  description: "Value to filter by (for filterNodes operation)"
                },
                nodeIds: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "IDs of nodes to highlight (for highlightNodes operation)"
                },
                color: { 
                  type: "string",
                  description: "Color to use for highlighting (for highlightNodes operation)"
                }
              }
            }
          },
          required: ["operation", "targetGraphId"]
        }
      }
    ]
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.error(`Tool request received at ${new Date().toISOString()}`);
  console.error(`Request params: ${JSON.stringify(request.params)}`);
  
  try {
    // Extract the actual tool name and arguments from the request
    const toolName = request.params.name;
    const toolArgs = request.params.arguments || {};
    const conversationId = request.params.conversation_id || 'default';

    console.error(`Processing tool: ${toolName}, conversation ID: ${conversationId}`);
    
    try {
      server.sendLoggingMessage({
        level: "info",
        data: {
          message: "Tool request received",
          toolName,
          conversationId
        },
      });
    } catch (loggingError) {
      console.error("Failed to send logging message, continuing anyway:", loggingError);
    }

    if (toolName === "knowledge_graph_manipulator") {
      console.error("Validating graph manipulation arguments...");
      const validatedArgs = GraphManipulationSchema.parse(toolArgs);
      console.error(`Calling handleGraphManipulation with operation: ${validatedArgs.operation}`);
      return await handleGraphManipulation(validatedArgs, conversationId.toString());
    } else if (toolName === "store_conversation") {
      console.error("Processing store_conversation request");
      // Ensure messages is an array
      const messages = Array.isArray(toolArgs.messages) ? toolArgs.messages : [];
      console.error(`Storing ${messages.length} messages for conversation: ${conversationId}`);
      const result = storeConversation(conversationId.toString(), messages);
      return {
        content: [{ 
          type: 'text', 
          text: result.success ? "Conversation stored successfully" : "Failed to store conversation" 
        }]
      };
    }

    console.error(`Unknown tool requested: ${toolName}`);
    // Default return for unknown tool
    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${toolName}`,
        },
      ],
    };
  } catch (error) {
    console.error(`Error processing tool request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (error instanceof Error && error.stack) {
      console.error(`Stack trace: ${error.stack}`);
    }
    
    if (error instanceof z.ZodError) {
      console.error(`Validation error: ${JSON.stringify(error.errors)}`);
      return {
        content: [
          {
            type: "text",
            text: `Invalid arguments: ${error.errors
              .map((e) => `${e.path.join(".")}: ${e.message}`)
              .join(", ")}`,
          },
        ],
      };
    }
    
    // Return error message for any other errors
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
    };
  }
});

// Start the server
async function main() {
  try {
    // console.error(`Main function started at ${new Date().toISOString()}`);
    
    // console.error("Creating StdioServerTransport...");
    const transport = new StdioServerTransport();
    
    // console.error("Connecting to transport...");
    await server.connect(transport);
    
    // console.error("Server connected, now sending logging message...");
    
    // Only send logging messages after the server is connected
    server.sendLoggingMessage({
      level: "info",
      data: {
        message: "GraphManipulate MCP Server running on stdio"
      },
    });
    
    // console.error("GraphManipulate MCP Server running on stdio");
    // console.error(`Server initialization completed at ${new Date().toISOString()}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error("Fatal error in main():", errorMessage);
    if (error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }
    process.exit(1);
  }
}

// Add process error handlers
process.on('uncaughtException', (error) => {
  console.error(`Uncaught exception: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

console.error("About to call main() function...");
main(); 