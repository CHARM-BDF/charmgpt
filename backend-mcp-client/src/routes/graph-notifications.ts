import { Router, Request, Response } from 'express';

const router = Router();

// Store active SSE connections per conversation
const connections = new Map<string, Response[]>();

// SSE endpoint for graph notifications
router.get('/:conversationId/events', (req: Request, res: Response) => {
  const { conversationId } = req.params;
  
  console.log(`[GRAPH-NOTIFICATIONS] New SSE connection for conversation: ${conversationId}`);
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
  res.flushHeaders();
  
  // Add connection to map
  if (!connections.has(conversationId)) {
    connections.set(conversationId, []);
  }
  connections.get(conversationId)!.push(res);
  
  console.log(`[GRAPH-NOTIFICATIONS] Active connections for ${conversationId}: ${connections.get(conversationId)!.length}`);
  
  // Remove connection on close
  req.on('close', () => {
    console.log(`[GRAPH-NOTIFICATIONS] SSE connection closed for conversation: ${conversationId}`);
    const conns = connections.get(conversationId);
    if (conns) {
      const index = conns.indexOf(res);
      if (index > -1) conns.splice(index, 1);
      console.log(`[GRAPH-NOTIFICATIONS] Remaining connections for ${conversationId}: ${conns.length}`);
    }
  });
  
  // Send keepalive every 30 seconds
  const keepalive = setInterval(() => {
    try {
      res.write(':\n\n');
    } catch (error) {
      console.log(`[GRAPH-NOTIFICATIONS] Keepalive failed, connection likely closed: ${error}`);
      clearInterval(keepalive);
    }
  }, 30000);
  
  req.on('close', () => clearInterval(keepalive));
});

// Broadcast endpoint for MCP servers to trigger notifications
router.post('/:conversationId/broadcast', (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const notification = req.body;
  
  console.log(`[GRAPH-NOTIFICATIONS] Broadcasting notification for ${conversationId}:`, notification);
  
  broadcastGraphNotification(conversationId, notification);
  
  res.json({ success: true, message: 'Notification broadcasted' });
});

// Function to broadcast notification to all connections for a conversation
export function broadcastGraphNotification(
  conversationId: string, 
  notification: {
    type: string;
    nodeCount?: number;
    edgeCount?: number;
    message: string;
  }
) {
  const conns = connections.get(conversationId);
  if (conns && conns.length > 0) {
    const data = JSON.stringify(notification);
    console.log(`[GRAPH-NOTIFICATIONS] Sending to ${conns.length} connections: ${data}`);
    
    conns.forEach((conn, index) => {
      try {
        conn.write(`data: ${data}\n\n`);
        console.log(`[GRAPH-NOTIFICATIONS] Sent to connection ${index + 1}`);
      } catch (error) {
        console.error(`[GRAPH-NOTIFICATIONS] Failed to send to connection ${index + 1}:`, error);
        // Remove failed connection
        conns.splice(index, 1);
      }
    });
  } else {
    console.log(`[GRAPH-NOTIFICATIONS] No active connections for conversation: ${conversationId}`);
  }
}

export default router;
