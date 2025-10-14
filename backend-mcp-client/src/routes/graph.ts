import express, { Request, Response } from 'express';
import { GraphDatabaseService } from '../services/database';
import { LoggingService } from '../services/logging';

const router = express.Router();

// Lazy-load database service to avoid Prisma client errors at module load
let graphDb: GraphDatabaseService | null = null;

const getGraphDb = () => {
  if (!graphDb) {
    console.log('Initializing GraphDatabaseService...');
    graphDb = new GraphDatabaseService();
  }
  return graphDb;
};

// Test route to verify graph router is working
router.get('/test', (req, res) => {
  console.log('🔥 GRAPH TEST ROUTE HIT! 🔥');
  res.json({ success: true, message: 'Graph router is working!' });
});

// GET /api/graph/:conversationId/state - Get current graph state
router.get('/:conversationId/state', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const loggingService = req.app.locals.loggingService as LoggingService;
    
    // console.log('🔥 [GRAPH-API] Getting graph state for conversation:', conversationId);
    // console.log('🔥 [GRAPH-API] Request headers:', req.headers);
    // console.log('🔥 [GRAPH-API] Request URL:', req.url);
    
    loggingService.log('info', `Getting graph state for conversation: ${conversationId}`);
    
    const graphState = await getGraphDb().getCurrentGraphState(conversationId);
    
    // console.log('🔥 [GRAPH-API] Graph state result:', {
    //   hasGraphState: !!graphState,
    //   nodeCount: graphState?.nodes?.length || 0,
    //   edgeCount: graphState?.edges?.length || 0,
    //   conversationId: conversationId
    // });
    
    if (!graphState) {
      // Return empty state for conversations without graph data yet
      return res.json({
        success: true,
        data: {
          nodes: [],
          edges: [],
          metadata: {
            nodeCount: 0,
            edgeCount: 0,
            lastUpdated: new Date().toISOString()
          }
        }
      });
    }
    
    res.json({
      success: true,
      data: graphState
    });
  } catch (error) {
    console.error('Error getting graph state:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/graph/:conversationId/init - Initialize GraphProject for new conversation
router.post('/:conversationId/init', async (req: Request, res: Response) => {
  console.error('🔥🔥🔥 [GRAPH-INIT] ENDPOINT HIT! 🔥🔥🔥');
  console.error('🔥 [GRAPH-INIT] Request path:', req.path);
  console.error('🔥 [GRAPH-INIT] Request params:', req.params);
  console.error('🔥 [GRAPH-INIT] Request body:', req.body);
  
  try {
    console.error('🔥 [GRAPH-INIT] Extracting params...');
    const { conversationId } = req.params;
    console.error('🔥 [GRAPH-INIT] conversationId:', conversationId);
    
    const { name, description } = req.body;
    console.error('🔥 [GRAPH-INIT] name:', name, 'description:', description);
    
    const loggingService = req.app.locals.loggingService as LoggingService;
    console.error('🔥 [GRAPH-INIT] loggingService obtained');
    
    console.error('🔥 [GRAPH-INIT] About to log to loggingService...');
    loggingService.log('info', `Initializing GraphProject for conversation: ${conversationId}`);
    console.error('🔥 [GRAPH-INIT] Logged to loggingService');
    
    console.error('🔥 [GRAPH-INIT] Getting database instance...');
    const db = getGraphDb();
    console.error('🔥 [GRAPH-INIT] Database instance obtained');
    
    // Check if GraphProject already exists
    console.error('🔥 [GRAPH-INIT] Checking if GraphProject exists...');
    let graphProject = await db.getGraphProject(conversationId);
    console.error('🔥 [GRAPH-INIT] GraphProject check complete, result:', graphProject ? 'EXISTS' : 'NOT FOUND');
    
    if (!graphProject) {
      console.error('🔥 [GRAPH-INIT] Creating new GraphProject...');
      graphProject = await db.createGraphProject(
        conversationId,
        name || `Graph Mode ${conversationId.slice(0, 8)}`,
        description || 'Graph Mode conversation'
      );
      console.error('✅ [GRAPH-INIT] Created new GraphProject:', graphProject.id);
    } else {
      console.error('ℹ️ [GRAPH-INIT] GraphProject already exists:', graphProject.id);
    }
    
    res.json({
      success: true,
      data: graphProject
    });
  } catch (error) {
    console.error('❌ [GRAPH-INIT] Error initializing graph project:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/graph/:conversationId/nodes - Add a new node
router.post('/:conversationId/nodes', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { id, label, type, data, position } = req.body;
    const loggingService = req.app.locals.loggingService as LoggingService;
    
    // console.error(`[GRAPH-API] 📥 Received node creation request for conversation: ${conversationId}`);
    // console.error(`[GRAPH-API] 📥 Node data:`, JSON.stringify(req.body, null, 2));
    // console.error(`[GRAPH-API] 📥 Request headers:`, req.headers);
    
    loggingService.log('info', `Adding node to conversation: ${conversationId}`);
    
    // Get or create graph project for this conversation
    const db = getGraphDb();
    let graphProject = await db.getGraphProject(conversationId);
    if (!graphProject) {
      // Create new graph project for this conversation
      graphProject = await db.createGraphProject(
        conversationId, 
        `Graph Mode ${conversationId.slice(0, 8)}`,
        'Graph Mode conversation'
      );
    }
    
    const node = await db.addNode(
      graphProject.id,
      label || 'New Node',
      type || 'default',
      data || {},
      position || { x: 0, y: 0 },
      id // Pass the id as customId parameter
    );
    
    // console.error(`[GRAPH-API] ✅ Node created with ID: ${node.id}`);
    // console.error(`[GRAPH-API] ✅ Node details:`, JSON.stringify(node, null, 2));
    
    // Save state for undo/redo
    await db.saveState(
      graphProject.id,
      `Added node: ${label}`,
      await db.getCurrentGraphState(conversationId)
    );
    
    // console.error(`[GRAPH-API] ✅ State saved for undo/redo`);
    
    res.json({
      success: true,
      data: node
    });
  } catch (error) {
    console.error('Error adding node:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/graph/:conversationId/edges - Add a new edge
router.post('/:conversationId/edges', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { source, target, label, type, data } = req.body;
    const loggingService = req.app.locals.loggingService as LoggingService;
    
    // console.error(`[GRAPH-API] 📥 Received edge creation request for conversation: ${conversationId}`);
    // console.error(`[GRAPH-API] 📥 Edge data:`, JSON.stringify(req.body, null, 2));
    
    loggingService.log('info', `Adding edge to conversation: ${conversationId}`);
    
    const db = getGraphDb();
    const graphProject = await db.getGraphProject(conversationId);
    if (!graphProject) {
      return res.status(404).json({
        success: false,
        error: 'Graph not found for this conversation'
      });
    }
    
    const edge = await db.addEdge(
      graphProject.id,
      source,
      target,
      label,
      type,
      data || {}
    );
    
    // console.error(`[GRAPH-API] ✅ Edge created: ${source} -> ${target}`);
    // console.error(`[GRAPH-API] ✅ Edge details:`, JSON.stringify(edge, null, 2));
    
    // Save state for undo/redo
    await db.saveState(
      graphProject.id,
      `Added edge: ${source} -> ${target}`,
      await db.getCurrentGraphState(conversationId)
    );
    
    // console.error(`[GRAPH-API] ✅ State saved for undo/redo`);
    
    res.json({
      success: true,
      data: edge
    });
  } catch (error) {
    console.error('Error adding edge:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/graph/:conversationId/edges/bulk - Bulk add edges
router.post('/:conversationId/edges/bulk', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { edges } = req.body; // Array of edge objects with composite IDs
    const loggingService = req.app.locals.loggingService as LoggingService;
    
    loggingService.log('info', `Bulk adding ${edges.length} edges to conversation: ${conversationId}`);
    
    const db = getGraphDb();
    const graphProject = await db.getGraphProject(conversationId);
    if (!graphProject) {
      return res.status(404).json({
        success: false,
        error: 'Graph not found for this conversation'
      });
    }
    
    // Add graphId to all edges
    const edgesWithGraphId = edges.map((edge: any) => ({
      id: edge.id, // Composite ID already generated by MCP
      graphId: graphProject.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: edge.type || 'default',
      data: edge.data || {},
      createdAt: new Date()
    }));
    
    // Bulk insert with automatic deduplication
    const result = await db.bulkCreateEdges(edgesWithGraphId);
    
    // Save state for undo/redo
    await db.saveState(
      graphProject.id,
      `Bulk added ${result.count} edges`,
      await db.getCurrentGraphState(conversationId)
    );
    
    res.json({
      success: true,
      created: result.count,
      skipped: edges.length - result.count,
      total: edges.length
    });
  } catch (error) {
    console.error('Error bulk adding edges:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/graph/:conversationId/nodes/bulk - Bulk add nodes
router.post('/:conversationId/nodes/bulk', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { nodes } = req.body; // Array of node objects
    const loggingService = req.app.locals.loggingService as LoggingService;
    
    loggingService.log('info', `Bulk adding ${nodes.length} nodes to conversation: ${conversationId}`);
    
    // Get or create graph project
    const db = getGraphDb();
    let graphProject = await db.getGraphProject(conversationId);
    if (!graphProject) {
      graphProject = await db.createGraphProject(
        conversationId, 
        `Graph Mode ${conversationId.slice(0, 8)}`,
        'Graph Mode conversation'
      );
    }
    
    // Add graphId to all nodes
    const nodesWithGraphId = nodes.map((node: any) => ({
      id: node.id,
      graphId: graphProject.id,
      label: node.label,
      type: node.type,
      data: node.data || {},
      position: node.position || { x: 0, y: 0 },
      createdAt: new Date()
    }));
    
    // Bulk insert with automatic deduplication
    const result = await db.bulkCreateNodes(nodesWithGraphId);
    
    // Save state for undo/redo
    await db.saveState(
      graphProject.id,
      `Bulk added ${result.count} nodes`,
      await db.getCurrentGraphState(conversationId)
    );
    
    res.json({
      success: true,
      created: result.count,
      skipped: nodes.length - result.count,
      total: nodes.length
    });
  } catch (error) {
    console.error('Error bulk adding nodes:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/graph/:conversationId/nodes/:nodeId - Update node
router.put('/:conversationId/nodes/:nodeId', async (req: Request, res: Response) => {
  try {
    const { conversationId, nodeId } = req.params;
    const updates = req.body; // { label?, type?, data?, position? }
    const loggingService = req.app.locals.loggingService as LoggingService;
    
    loggingService.log('info', `Updating node ${nodeId} in conversation: ${conversationId}`);
    
    const graphProject = await graphDb.getGraphProject(conversationId);
    if (!graphProject) {
      return res.status(404).json({ 
        success: false,
        error: 'Graph project not found for this conversation' 
      });
    }
    
    const result = await graphDb.updateNode(nodeId, graphProject.id, updates);
    
    // Save state for undo/redo
    await graphDb.saveState(
      graphProject.id,
      `Updated node: ${nodeId}`,
      await graphDb.getCurrentGraphState(conversationId)
    );
    
    res.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error('Error updating node:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/graph/:conversationId/nodes/:nodeId - Delete a node
router.delete('/:conversationId/nodes/:nodeId', async (req: Request, res: Response) => {
  try {
    const { conversationId, nodeId } = req.params;
    const loggingService = req.app.locals.loggingService as LoggingService;
    
    loggingService.log('info', `Deleting node ${nodeId} from conversation: ${conversationId}`);
    
    // Get graph project to get graphId
    const graphProject = await graphDb.getGraphProject(conversationId);
    if (!graphProject) {
      return res.status(404).json({
        success: false,
        error: 'Graph project not found for this conversation'
      });
    }
    
    // Delete node with correct parameters
    await graphDb.deleteNode(nodeId, graphProject.id);
    
    // Save state for undo/redo
    await graphDb.saveState(
      graphProject.id,
      `Deleted node: ${nodeId}`,
      await graphDb.getCurrentGraphState(conversationId)
    );
    
    res.json({
      success: true,
      message: 'Node deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting node:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/graph/:conversationId/edges/:edgeId - Delete an edge
router.delete('/:conversationId/edges/:edgeId', async (req: Request, res: Response) => {
  try {
    const { conversationId, edgeId } = req.params;
    const loggingService = req.app.locals.loggingService as LoggingService;
    
    loggingService.log('info', `Deleting edge ${edgeId} from conversation: ${conversationId}`);
    
    // Get graph project to obtain graphId
    const graphProject = await graphDb.getGraphProject(conversationId);
    if (!graphProject) {
      return res.status(404).json({
        success: false,
        error: 'Graph project not found for this conversation'
      });
    }
    
    // Delete edge with correct graphId parameter
    await graphDb.deleteEdge(edgeId, graphProject.id);
    
    // Save state for undo/redo
    await graphDb.saveState(
      graphProject.id,
      `Deleted edge: ${edgeId}`,
      await graphDb.getCurrentGraphState(conversationId)
    );
    
    res.json({
      success: true,
      message: 'Edge deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting edge:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/graph/:conversationId/mock-data - Add mock data for testing
router.post('/:conversationId/mock-data', async (req: Request, res: Response) => {
  // console.log('🔥 GRAPH ROUTE HIT! 🔥');
  // console.log('Request URL:', req.url);
  // console.log('Request method:', req.method);
  // console.log('Request params:', req.params);
  
  try {
    const { conversationId } = req.params;
    const { dataset = 'diabetes' } = req.body; // Default to diabetes dataset
    const loggingService = req.app.locals.loggingService as LoggingService;
    
    // console.log(`=== MOCK DATA REQUEST START - Dataset: ${dataset} ===`);
    // console.log('Conversation ID:', conversationId);
    loggingService.log('info', `Adding mock data to conversation: ${conversationId}`);
    
    // Get or create graph project for this conversation
    // console.log('Checking for existing graph project...');
    const db = getGraphDb();
    let graphProject = await db.getGraphProject(conversationId);
    // console.log('Existing graph project:', graphProject ? 'Found' : 'Not found');
    
    if (!graphProject) {
      // console.log('Creating new graph project...');
      graphProject = await db.createGraphProject(
        conversationId, 
        `Graph Mode ${conversationId.slice(0, 8)}`,
        'Graph Mode conversation with mock data'
      );
      // console.log('Created graph project:', graphProject.id);
    }
    
    // Create mock nodes based on dataset
    // console.log(`Creating ${dataset} mock nodes...`);
    let mockNodes;
    
    if (dataset === 'cancer') {
      // Cancer research data
      mockNodes = [
        { 
          label: 'STAT4', 
          type: 'gene', 
          canonicalId: 'NCBIGene:6775',
          category: 'Gene',
          position: { x: -200, y: -150 },
          data: { category: 'gene', expression: 'high' }
        },
        { 
          label: 'Sorafenib', 
          type: 'drug', 
          canonicalId: 'CHEBI:50924',
          category: 'Drug',
          position: { x: -100, y: -150 },
          data: { category: 'drug' }
        },
        { 
          label: 'Liver Cancer', 
          type: 'disease', 
          canonicalId: 'MONDO:0007254',
          category: 'Disease',
          position: { x: 0, y: -150 },
          data: { category: 'disease' }
        },
        { 
          label: 'RAF1', 
          type: 'gene', 
          canonicalId: 'NCBIGene:5894',
          category: 'Gene',
          position: { x: -200, y: 0 },
          data: { category: 'gene', expression: 'medium' }
        },
        { 
          label: 'MAPK1', 
          type: 'gene', 
          canonicalId: 'NCBIGene:5594',
          category: 'Gene',
          position: { x: -100, y: 0 },
          data: { category: 'gene', expression: 'high' }
        },
        { 
          label: 'Hepatocellular Carcinoma', 
          type: 'disease', 
          canonicalId: 'MONDO:0007254',
          category: 'Disease',
          position: { x: 0, y: 0 },
          data: { category: 'disease' }
        },
        { 
          label: 'JAK-STAT Pathway', 
          type: 'pathway', 
          canonicalId: 'KEGG:hsa04630',
          category: 'Pathway',
          position: { x: -200, y: 150 },
          data: { category: 'pathway' }
        },
        { 
          label: 'MAPK Pathway', 
          type: 'pathway', 
          canonicalId: 'KEGG:hsa04010',
          category: 'Pathway',
          position: { x: -100, y: 150 },
          data: { category: 'pathway' }
        }
      ];
    } else {
      // Default diabetes/obesity data
      mockNodes = [
        { 
          label: 'TP53', 
          type: 'gene', 
          canonicalId: 'NCBIGene:7157',
          category: 'Gene',
          position: { x: -150, y: -100 },
          data: { category: 'gene', expression: 'medium' }
        },
        { 
          label: 'PPARG', 
          type: 'gene', 
          canonicalId: 'NCBIGene:5468',
          category: 'Gene',
          position: { x: -50, y: -100 },
          data: { category: 'gene', expression: 'high' }
        },
        { 
          label: 'INS', 
          type: 'gene', 
          canonicalId: 'NCBIGene:3630',
          category: 'Gene',
          position: { x: 50, y: -100 },
          data: { category: 'gene', expression: 'high' }
        },
        { 
          label: 'LEP', 
          type: 'gene', 
          canonicalId: 'NCBIGene:3952',
          category: 'Gene',
          position: { x: 150, y: -100 },
          data: { category: 'gene', expression: 'medium' }
        },
        { 
          label: 'Type 2 Diabetes', 
          type: 'disease', 
          canonicalId: 'MONDO:0005148',
          category: 'Disease',
          position: { x: -100, y: 100 },
          data: { category: 'disease' }
        },
        { 
          label: 'Obesity', 
          type: 'disease', 
          canonicalId: 'MONDO:0005151',
          category: 'Disease',
          position: { x: 100, y: 100 },
          data: { category: 'disease' }
        },
        { 
          label: 'Insulin', 
          type: 'protein', 
          canonicalId: 'UniProtKB:P01308',
          category: 'Protein',
          position: { x: 0, y: 0 },
          data: { category: 'protein' }
        },
        { 
          label: 'Leptin', 
          type: 'protein', 
          canonicalId: 'UniProtKB:P41159',
          category: 'Protein',
          position: { x: 0, y: 50 },
          data: { category: 'protein' }
        }
      ];
    }
    
    // console.log('Mock nodes data:', mockNodes);
    const createdNodes = [];
    
    for (let i = 0; i < mockNodes.length; i++) {
      const nodeData = mockNodes[i];
      // console.log(`Creating node ${i + 1}/${mockNodes.length}:`, nodeData);
      
      try {
        const node = await db.addNode(
          graphProject.id,
          nodeData.label,
          nodeData.type,
          nodeData.data || { 
            description: `${dataset} related ${nodeData.category}`,
            canonicalId: nodeData.canonicalId,
            category: nodeData.category
          },
          nodeData.position,
          nodeData.canonicalId // Use canonicalId as custom ID
        );
        // console.log(`Successfully created/updated node ${i + 1}:`, node.id);
        createdNodes.push(node);
      } catch (nodeError) {
        console.error(`Error creating node ${i + 1}:`, JSON.stringify(nodeError, null, 2));
        console.error(`Node data that failed:`, JSON.stringify(nodeData, null, 2));
        throw nodeError;
      }
    }
    
    // console.log('All nodes created successfully:', createdNodes.length);
    // console.log('Created nodes details:', createdNodes.map((node, i) => `${i}: ${node.id} (${node.label})`));
    
    // Create mock edges based on dataset
    // console.log(`Creating ${dataset} mock edges...`);
    let mockEdges;
    
    if (dataset === 'cancer') {
      // Verify we have enough nodes for cancer dataset
      if (createdNodes.length < 8) {
        throw new Error(`Cancer dataset requires 8 nodes, but only ${createdNodes.length} were created`);
      }
      
      // Cancer research relationships
      mockEdges = [
        // Drug-target relationships
        { source: createdNodes[1].id, target: createdNodes[3].id, label: 'inhibits', type: 'pharmacological' }, // Sorafenib -> RAF1
        { source: createdNodes[1].id, target: createdNodes[4].id, label: 'inhibits', type: 'pharmacological' }, // Sorafenib -> MAPK1
        
        // Gene-pathway relationships
        { source: createdNodes[0].id, target: createdNodes[6].id, label: 'part_of', type: 'biological' }, // STAT4 -> JAK-STAT Pathway
        { source: createdNodes[3].id, target: createdNodes[7].id, label: 'part_of', type: 'biological' }, // RAF1 -> MAPK Pathway
        { source: createdNodes[4].id, target: createdNodes[7].id, label: 'part_of', type: 'biological' }, // MAPK1 -> MAPK Pathway
        
        // Gene-disease relationships
        { source: createdNodes[0].id, target: createdNodes[2].id, label: 'associated_with', type: 'biological' }, // STAT4 -> Liver Cancer
        { source: createdNodes[3].id, target: createdNodes[5].id, label: 'associated_with', type: 'biological' }, // RAF1 -> HCC
        { source: createdNodes[4].id, target: createdNodes[5].id, label: 'associated_with', type: 'biological' }, // MAPK1 -> HCC
        
        // Disease relationships
        { source: createdNodes[2].id, target: createdNodes[5].id, label: 'subtype_of', type: 'clinical' } // Liver Cancer -> HCC
      ];
      
      // console.log('Cancer mockEdges constructed:', mockEdges.length, 'edges');
      // console.log('Edge 7 details:', JSON.stringify(mockEdges[6], null, 2));
    } else {
      // Default diabetes/obesity relationships
      mockEdges = [
        // Gene to Protein relationships
        { source: createdNodes[0].id, target: createdNodes[6].id, label: 'encodes', type: 'biological' }, // TP53 -> Insulin
        { source: createdNodes[1].id, target: createdNodes[7].id, label: 'encodes', type: 'biological' }, // PPARG -> Leptin
        { source: createdNodes[2].id, target: createdNodes[6].id, label: 'encodes', type: 'biological' }, // INS -> Insulin
        { source: createdNodes[3].id, target: createdNodes[7].id, label: 'encodes', type: 'biological' }, // LEP -> Leptin
        
        // Gene to Disease relationships
        { source: createdNodes[0].id, target: createdNodes[4].id, label: 'associated_with', type: 'biological' }, // TP53 -> Type 2 Diabetes
        { source: createdNodes[1].id, target: createdNodes[4].id, label: 'associated_with', type: 'biological' }, // PPARG -> Type 2 Diabetes
        { source: createdNodes[3].id, target: createdNodes[5].id, label: 'associated_with', type: 'biological' }, // LEP -> Obesity
        
        // Protein to Disease relationships
        { source: createdNodes[6].id, target: createdNodes[4].id, label: 'involved_in', type: 'biological' }, // Insulin -> Type 2 Diabetes
        { source: createdNodes[7].id, target: createdNodes[5].id, label: 'involved_in', type: 'biological' }, // Leptin -> Obesity
        
        // Cross-disease relationships
        { source: createdNodes[4].id, target: createdNodes[5].id, label: 'comorbid_with', type: 'clinical' } // Type 2 Diabetes <-> Obesity
      ];
    }
    
    // console.log('Mock edges data:', mockEdges);
    const createdEdges = [];
    
    for (let i = 0; i < mockEdges.length; i++) {
      const edgeData = mockEdges[i];
      // console.log(`Creating edge ${i + 1}/${mockEdges.length}:`, JSON.stringify(edgeData, null, 2));
      // console.log(`Edge ${i + 1} source node exists:`, !!edgeData.source);
      // console.log(`Edge ${i + 1} target node exists:`, !!edgeData.target);
      
      try {
        const edge = await db.addEdge(
          graphProject.id,
          edgeData.source,
          edgeData.target,
          edgeData.label,
          edgeData.type,
          { description: `Mock ${edgeData.type} relationship` }
        );
        // console.log(`Successfully created edge ${i + 1}:`, edge.id);
        createdEdges.push(edge);
      } catch (edgeError) {
        console.error(`Error creating edge ${i + 1}:`, JSON.stringify(edgeError, null, 2));
        console.error(`Edge data that failed:`, JSON.stringify(edgeData, null, 2));
        throw edgeError;
      }
    }
    
    // console.log('All edges created successfully:', createdEdges.length);
    
    // Save state for undo/redo
    // console.log('Saving state for undo/redo...');
    try {
      const currentState = await db.getCurrentGraphState(conversationId);
      // console.log('Current graph state:', currentState);
      
      await db.saveState(
        graphProject.id,
        'Added mock data',
        currentState
      );
      // console.log('State saved successfully');
    } catch (stateError) {
      console.error('Error saving state:', stateError);
      // Don't throw here, just log the error
    }
    
    // console.log('=== MOCK DATA REQUEST SUCCESS ===');
    // console.log('Created nodes:', createdNodes.length);
    // console.log('Created edges:', createdEdges.length);
    
    res.json({
      success: true,
      data: {
        nodes: createdNodes,
        edges: createdEdges,
        message: 'Mock data added successfully'
      }
    });
  } catch (error) {
    console.error('Error adding mock data:', error);
    console.error('Full error details:', JSON.stringify(error, null, 2));
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : 'No stack trace'
    });
  }
});

// GET /api/graph/:conversationId/history - Get graph state history
router.get('/:conversationId/history', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { limit = 20 } = req.query;
    const loggingService = req.app.locals.loggingService as LoggingService;
    
    loggingService.log('info', `Getting graph history for conversation: ${conversationId}`);
    
    const graphProject = await graphDb.getGraphProject(conversationId);
    if (!graphProject) {
      return res.status(404).json({
        success: false,
        error: 'Graph not found for this conversation'
      });
    }
    
    const history = await graphDb.getStateHistory(graphProject.id, Number(limit));
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error getting graph history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
