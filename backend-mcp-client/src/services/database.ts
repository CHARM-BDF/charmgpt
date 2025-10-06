import { PrismaClient } from '@prisma/client';

// Global Prisma client instance
let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
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
    console.log('Adding node with data:', { graphId, label, type, data, position, customId });
    
    const nodeData = {
      ...(customId && { id: customId }),
      graphId,
      label,
      type,
      data: data ? JSON.parse(JSON.stringify(data)) : {},
      position: position ? JSON.parse(JSON.stringify(position)) : { x: 0, y: 0 },
    };
    
    console.log('Serialized node data:', nodeData);
    
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
        return await this.prisma.graphNode.updateMany({
          where: { 
            id: nodeData.id,
            graphId: nodeData.graphId
          },
          data: {
            label: nodeData.label,
            type: nodeData.type,
            data: nodeData.data,
            position: nodeData.position,
          }
        });
      }
    }
    
    // Create new node
    return await this.prisma.graphNode.create({
      data: nodeData,
    });
  }

  async addNodeWithCanonicalId(graphId: string, label: string, type: string, canonicalId: string, category: string, data?: any, position?: { x: number; y: number }) {
    console.log('Adding node with canonical ID:', { graphId, label, type, canonicalId, category, data, position });
    
    const nodeData = {
      id: canonicalId, // Use canonicalId as the primary ID
      graphId,
      label,
      type,
      data: data ? JSON.parse(JSON.stringify(data)) : {},
      position: position ? JSON.parse(JSON.stringify(position)) : { x: 0, y: 0 },
    };
    
    console.log('Serialized node data with canonical ID:', nodeData);
    
    // Use upsert to handle existing nodes
    return await this.prisma.graphNode.upsert({
      where: { id: canonicalId },
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
    console.log('Looking for node with canonical ID in graph:', { graphId, canonicalId });
    
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
    return await this.prisma.graphEdge.create({
      data: {
        graphId,
        source,
        target,
        label,
        type,
        data: data ? JSON.parse(JSON.stringify(data)) : {},
      },
    });
  }

  async deleteEdge(edgeId: string) {
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
  async disconnect() {
    await this.prisma.$disconnect();
  }
}
