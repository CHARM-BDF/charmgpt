import { PrismaClient } from '@prisma/client';

// Global Prisma client instance
let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    // Ensure DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = "file:./prisma/dev.db";
    }
    
    prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }
  return prisma;
}

// Graph Mode Database Service
export class GraphDatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  // Graph Project Operations (conversation-based)
  async createGraphProject(conversationId: string, conversationName: string, description?: string) {
    return await this.prisma.graphProject.create({
      data: {
        name: conversationName, // Add the required 'name' field
        conversationId,
        conversationName,
        description,
      },
    });
  }

  async getGraphProject(conversationId: string) {
    return await this.prisma.graphProject.findUnique({
      where: { conversationId },
      include: {
        nodes: true,
        edges: true,
        states: {
          orderBy: { timestamp: 'desc' },
          take: 10, // Last 10 states for history
        },
      },
    });
  }

  // Node Operations
  async addNode(graphId: string, label: string, type: string, data?: any, position?: { x: number; y: number }, customId?: string) {
    // console.error(`[DATABASE] 📝 Writing node to database - graphId: ${graphId}, customId: ${customId}`);
    // console.error(`[DATABASE] 📝 Node data:`, { graphId, label, type, data, position, customId });
    
    const nodeData = {
      ...(customId && { id: customId }),
      graphId,
      label,
      type,
      data: data ? JSON.parse(JSON.stringify(data)) : {},
      position: position ? JSON.parse(JSON.stringify(position)) : { x: 0, y: 0 },
    };
    
    // console.log('Serialized node data:', nodeData);
    
    // Check if node with this ID already exists in the same graph
    if (nodeData.id) {
      const existingNode = await this.prisma.graphNode.findFirst({
        where: { 
          id: nodeData.id,
          graphId: nodeData.graphId
        }
      });
      
      if (existingNode) {
        // Update existing node using the composite key
        const updatedNode = await this.prisma.graphNode.update({
          where: { 
            id_graphId: {
              id: nodeData.id,
              graphId: nodeData.graphId
            }
          },
          data: {
            label: nodeData.label,
            type: nodeData.type,
            data: nodeData.data,
            position: nodeData.position,
          }
        });
        // console.error(`[DATABASE] ✅ Node updated successfully - id: ${updatedNode.id}`);
        // console.error(`[DATABASE] ✅ Node update result:`, JSON.stringify(updatedNode, null, 2));
        return updatedNode;
      }
    }
    
    // Create new node
    const result = await this.prisma.graphNode.create({
      data: nodeData,
    });
    
    // console.error(`[DATABASE] ✅ Node written successfully - id: ${result.id}`);
    // console.error(`[DATABASE] ✅ Node result:`, JSON.stringify(result, null, 2));
    
    return result;
  }

  async addNodeWithCanonicalId(graphId: string, label: string, type: string, canonicalId: string, category: string, data?: any, position?: { x: number; y: number }) {
    // console.log('Adding node with canonical ID:', { graphId, label, type, canonicalId, category, data, position });
    
    const nodeData = {
      id: canonicalId, // Use canonicalId as the primary ID
      graphId,
      label,
      type,
      data: data ? JSON.parse(JSON.stringify(data)) : {},
      position: position ? JSON.parse(JSON.stringify(position)) : { x: 0, y: 0 },
    };
    
    // console.log('Serialized node data with canonical ID:', nodeData);
    
    // Use upsert to handle existing nodes with composite key
    return await this.prisma.graphNode.upsert({
      where: { 
        id_graphId: {
          id: canonicalId,
          graphId: graphId
        }
      },
      update: {
        label,
        type,
        data: nodeData.data,
        position: nodeData.position,
      },
      create: nodeData,
    });
  }

  async getNodeByCanonicalId(graphId: string, canonicalId: string) {
    // console.log('Looking for node with canonical ID in graph:', { graphId, canonicalId });
    
    return await this.prisma.graphNode.findFirst({
      where: {
        id: canonicalId,
        graphId: graphId
      },
    });
  }

  async updateNode(nodeId: string, graphId: string, updates: { label?: string; type?: string; data?: any; position?: { x: number; y: number } }) {
    return await this.prisma.graphNode.updateMany({
      where: { 
        id: nodeId,
        graphId: graphId
      },
      data: updates,
    });
  }

  async deleteNode(nodeId: string, graphId: string) {
    return await this.prisma.graphNode.deleteMany({
      where: { 
        id: nodeId,
        graphId: graphId
      },
    });
  }

  // Edge Operations
  async addEdge(graphId: string, source: string, target: string, label?: string, type?: string, data?: any) {
    // console.error(`[DATABASE] 📝 Writing edge to database - graphId: ${graphId}, source: ${source}, target: ${target}`);
    // console.error(`[DATABASE] 📝 Edge data:`, { graphId, source, target, label, type, data });
    
    // Check for duplicate edge based on uniqueness constraint
    // Unique key: graphId + data.source + data.primary_source + source + label + target
    if (data?.source && data?.primary_source) {
      // Fetch all edges between these nodes with same label
      const potentialDuplicates = await this.prisma.graphEdge.findMany({
        where: {
          graphId,
          source,
          target,
          label
        }
      });
      
      // Check if any edge has matching MCP source and knowledge source
      for (const edge of potentialDuplicates) {
        const edgeData = edge.data as any;
        if (edgeData?.source === data.source && 
            edgeData?.primary_source === data.primary_source) {
          console.error(`[DATABASE] ⚠️ Edge already exists, returning existing edge: ${edge.id}`);
          console.error(`[DATABASE] ⚠️ Duplicate key: ${data.source} + ${data.primary_source} + ${source} + ${label} + ${target}`);
          return edge;
        }
      }
    }
    
    // Create new edge if no duplicate found
    const result = await this.prisma.graphEdge.create({
      data: {
        graphId,
        source,
        target,
        label,
        type,
        data: data ? JSON.parse(JSON.stringify(data)) : {},
      },
    });
    
    console.error(`[DATABASE] ✅ New edge created: ${result.id}`);
    // console.error(`[DATABASE] ✅ Edge result:`, JSON.stringify(result, null, 2));
    
    return result;
  }

  async deleteEdge(edgeId: string, graphId: string) {
    return await this.prisma.graphEdge.delete({
      where: { id: edgeId },
    });
  }

  // State Management for Undo/Redo
  async saveState(graphId: string, command: string, snapshot: any) {
    return await this.prisma.graphState.create({
      data: {
        graphId,
        command,
        snapshot: snapshot ? JSON.parse(JSON.stringify(snapshot)) : {},
      },
    });
  }

  async getStateHistory(graphId: string, limit: number = 20) {
    return await this.prisma.graphState.findMany({
      where: { graphId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  // Get current graph state for MCPs
  async getCurrentGraphState(conversationId: string) {
    const graphProject = await this.getGraphProject(conversationId);
    if (!graphProject) {
      return null;
    }

    return {
      nodes: graphProject.nodes,
      edges: graphProject.edges,
      metadata: {
        nodeCount: graphProject.nodes.length,
        edgeCount: graphProject.edges.length,
        lastUpdated: graphProject.updatedAt,
      },
    };
  }

  // Cleanup
  async bulkCreateNodes(nodes: any[]) {
    // Bulk insert - SQLite doesn't support skipDuplicates, so we'll handle duplicates gracefully
    let result;
    try {
      result = await this.prisma.graphNode.createMany({
        data: nodes
      });
    } catch (error: any) {
      // If we get a unique constraint error, try inserting one by one to skip duplicates
      if (error.code === 'P2002' || error.message?.includes('UNIQUE constraint failed')) {
        console.log('Bulk insert failed due to duplicates, falling back to individual inserts');
        let created = 0;
        for (const node of nodes) {
          try {
            await this.prisma.graphNode.create({ data: node });
            created++;
          } catch (nodeError: any) {
            // Skip duplicate nodes
            if (nodeError.code === 'P2002' || nodeError.message?.includes('UNIQUE constraint failed')) {
              continue;
            }
            throw nodeError;
          }
        }
        result = { count: created };
      } else {
        throw error;
      }
    }
    return result;
  }

  async bulkCreateEdges(edges: any[]) {
    // Bulk insert - SQLite doesn't support skipDuplicates, so we'll handle duplicates gracefully
    let result;
    try {
      result = await this.prisma.graphEdge.createMany({
        data: edges
      });
    } catch (error: any) {
      // If we get a unique constraint error, try inserting one by one to skip duplicates
      if (error.code === 'P2002' || error.message?.includes('UNIQUE constraint failed')) {
        console.log('Bulk insert failed due to duplicates, falling back to individual inserts');
        let created = 0;
        for (const edge of edges) {
          try {
            await this.prisma.graphEdge.create({ data: edge });
            created++;
          } catch (edgeError: any) {
            // Skip duplicate edges
            if (edgeError.code === 'P2002' || edgeError.message?.includes('UNIQUE constraint failed')) {
              continue;
            }
            throw edgeError;
          }
        }
        result = { count: created };
      } else {
        throw error;
      }
    }
    return result;
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}
