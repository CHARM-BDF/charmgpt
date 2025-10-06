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
    
    loggingService.log('info', `Getting graph state for conversation: ${conversationId}`);
    
    const graphState = await getGraphDb().getCurrentGraphState(conversationId);
    
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

// POST /api/graph/:conversationId/nodes - Add a new node
router.post('/:conversationId/nodes', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { label, type, data, position } = req.body;
    const loggingService = req.app.locals.loggingService as LoggingService;
    
    loggingService.log('info', `Adding node to conversation: ${conversationId}`);
    
    // Get or create graph project for this conversation
    let graphProject = await graphDb.getGraphProject(conversationId);
    if (!graphProject) {
      // Create new graph project for this conversation
      graphProject = await graphDb.createGraphProject(
        conversationId, 
        `Graph Mode ${conversationId.slice(0, 8)}`,
        'Graph Mode conversation'
      );
    }
    
    const node = await graphDb.addNode(
      graphProject.id,
      label || 'New Node',
      type || 'default',
      data || {},
      position || { x: 0, y: 0 }
    );
    
    // Save state for undo/redo
    await graphDb.saveState(
      graphProject.id,
      `Added node: ${label}`,
      await graphDb.getCurrentGraphState(conversationId)
    );
    
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
    
    loggingService.log('info', `Adding edge to conversation: ${conversationId}`);
    
    const graphProject = await graphDb.getGraphProject(conversationId);
    if (!graphProject) {
      return res.status(404).json({
        success: false,
        error: 'Graph not found for this conversation'
      });
    }
    
    const edge = await graphDb.addEdge(
      graphProject.id,
      source,
      target,
      label,
      type,
      data || {}
    );
    
    // Save state for undo/redo
    await graphDb.saveState(
      graphProject.id,
      `Added edge: ${source} -> ${target}`,
      await graphDb.getCurrentGraphState(conversationId)
    );
    
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

// DELETE /api/graph/:conversationId/nodes/:nodeId - Delete a node
router.delete('/:conversationId/nodes/:nodeId', async (req: Request, res: Response) => {
  try {
    const { conversationId, nodeId } = req.params;
    const loggingService = req.app.locals.loggingService as LoggingService;
    
    loggingService.log('info', `Deleting node ${nodeId} from conversation: ${conversationId}`);
    
    await graphDb.deleteNode(nodeId);
    
    // Save state for undo/redo
    const graphProject = await graphDb.getGraphProject(conversationId);
    if (graphProject) {
      await graphDb.saveState(
        graphProject.id,
        `Deleted node: ${nodeId}`,
        await graphDb.getCurrentGraphState(conversationId)
      );
    }
    
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
    
    await graphDb.deleteEdge(edgeId);
    
    // Save state for undo/redo
    const graphProject = await graphDb.getGraphProject(conversationId);
    if (graphProject) {
      await graphDb.saveState(
        graphProject.id,
        `Deleted edge: ${edgeId}`,
        await graphDb.getCurrentGraphState(conversationId)
      );
    }
    
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
  console.log('🔥 GRAPH ROUTE HIT! 🔥');
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);
  console.log('Request params:', req.params);
  
  try {
    const { conversationId } = req.params;
    const loggingService = req.app.locals.loggingService as LoggingService;
    
    console.log('=== MOCK DATA REQUEST START ===');
    console.log('Conversation ID:', conversationId);
    loggingService.log('info', `Adding mock data to conversation: ${conversationId}`);
    
    // Get or create graph project for this conversation
    console.log('Checking for existing graph project...');
    const db = getGraphDb();
    let graphProject = await db.getGraphProject(conversationId);
    console.log('Existing graph project:', graphProject ? 'Found' : 'Not found');
    
    if (!graphProject) {
      console.log('Creating new graph project...');
      graphProject = await db.createGraphProject(
        conversationId, 
        `Graph Mode ${conversationId.slice(0, 8)}`,
        'Graph Mode conversation with mock data'
      );
      console.log('Created graph project:', graphProject.id);
    }
    
    // Create mock nodes - Diabetes/Obesity related genes and diseases
    console.log('Creating mock nodes...');
    const mockNodes = [
      { 
        label: 'TP53', 
        type: 'gene', 
        canonicalId: 'NCBIGene:7157',
        category: 'Gene',
        position: { x: -150, y: -100 } 
      },
      { 
        label: 'PPARG', 
        type: 'gene', 
        canonicalId: 'NCBIGene:5468',
        category: 'Gene',
        position: { x: -50, y: -100 } 
      },
      { 
        label: 'INS', 
        type: 'gene', 
        canonicalId: 'NCBIGene:3630',
        category: 'Gene',
        position: { x: 50, y: -100 } 
      },
      { 
        label: 'LEP', 
        type: 'gene', 
        canonicalId: 'NCBIGene:3952',
        category: 'Gene',
        position: { x: 150, y: -100 } 
      },
      { 
        label: 'Type 2 Diabetes', 
        type: 'disease', 
        canonicalId: 'MONDO:0005148',
        category: 'Disease',
        position: { x: -100, y: 100 } 
      },
      { 
        label: 'Obesity', 
        type: 'disease', 
        canonicalId: 'MONDO:0005151',
        category: 'Disease',
        position: { x: 100, y: 100 } 
      },
      { 
        label: 'Insulin', 
        type: 'protein', 
        canonicalId: 'UniProtKB:P01308',
        category: 'Protein',
        position: { x: 0, y: 0 } 
      },
      { 
        label: 'Leptin', 
        type: 'protein', 
        canonicalId: 'UniProtKB:P41159',
        category: 'Protein',
        position: { x: 0, y: 50 } 
      }
    ];
    
    console.log('Mock nodes data:', mockNodes);
    const createdNodes = [];
    
    for (let i = 0; i < mockNodes.length; i++) {
      const nodeData = mockNodes[i];
      console.log(`Creating node ${i + 1}/${mockNodes.length}:`, nodeData);
      
      try {
        const node = await db.addNode(
          graphProject.id,
          nodeData.label,
          nodeData.type,
          { 
            description: `Diabetes/Obesity related ${nodeData.category}`,
            canonicalId: nodeData.canonicalId,
            category: nodeData.category
          },
          nodeData.position,
          nodeData.canonicalId // Use canonicalId as custom ID
        );
        console.log(`Successfully created/updated node ${i + 1}:`, node.id);
        createdNodes.push(node);
      } catch (nodeError) {
        console.error(`Error creating node ${i + 1}:`, nodeError);
        throw nodeError;
      }
    }
    
    console.log('All nodes created successfully:', createdNodes.length);
    
    // Create mock edges - Diabetes/Obesity relationships
    console.log('Creating mock edges...');
    const mockEdges = [
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
    
    console.log('Mock edges data:', mockEdges);
    const createdEdges = [];
    
    for (let i = 0; i < mockEdges.length; i++) {
      const edgeData = mockEdges[i];
      console.log(`Creating edge ${i + 1}/${mockEdges.length}:`, edgeData);
      
      try {
        const edge = await db.addEdge(
          graphProject.id,
          edgeData.source,
          edgeData.target,
          edgeData.label,
          edgeData.type,
          { description: `Mock ${edgeData.type} relationship` }
        );
        console.log(`Successfully created edge ${i + 1}:`, edge.id);
        createdEdges.push(edge);
      } catch (edgeError) {
        console.error(`Error creating edge ${i + 1}:`, edgeError);
        throw edgeError;
      }
    }
    
    console.log('All edges created successfully:', createdEdges.length);
    
    // Save state for undo/redo
    console.log('Saving state for undo/redo...');
    try {
      const currentState = await db.getCurrentGraphState(conversationId);
      console.log('Current graph state:', currentState);
      
      await db.saveState(
        graphProject.id,
        'Added mock data',
        currentState
      );
      console.log('State saved successfully');
    } catch (stateError) {
      console.error('Error saving state:', stateError);
      // Don't throw here, just log the error
    }
    
    console.log('=== MOCK DATA REQUEST SUCCESS ===');
    console.log('Created nodes:', createdNodes.length);
    console.log('Created edges:', createdEdges.length);
    
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
