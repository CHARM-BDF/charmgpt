const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Test configuration
const CONVERSATION_ID = uuidv4();

// Sample knowledge graph
const sampleGraph = {
  nodes: [
    { id: 'node1', name: 'Alice', type: 'person', department: 'Engineering' },
    { id: 'node2', name: 'Bob', type: 'person', department: 'Marketing' },
    { id: 'node3', name: 'Charlie', type: 'person', department: 'Engineering' },
    { id: 'node4', name: 'Acme Corp', type: 'company', industry: 'Technology' },
    { id: 'node5', name: 'Globex', type: 'company', industry: 'Finance' },
  ],
  links: [
    { source: 'node1', target: 'node4', label: 'works_at' },
    { source: 'node2', target: 'node4', label: 'works_at' },
    { source: 'node3', target: 'node5', label: 'works_at' },
  ]
};

// Create a sample artifact
const sampleArtifact = {
  id: uuidv4(),
  artifactId: uuidv4(),
  type: 'application/vnd.ant.knowledge-graph',
  title: 'Test Knowledge Graph',
  content: JSON.stringify(sampleGraph)
};

// Sample conversation with the artifact
const sampleConversation = [
  {
    role: 'assistant',
    artifacts: [sampleArtifact]
  }
];

// Start the MCP server process
const serverProcess = spawn('node', [path.join(__dirname, 'dist', 'index.js')]);
let responseBuffer = '';

// Set up event handlers
serverProcess.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  processResponses();
});

serverProcess.stderr.on('data', (data) => {
  console.log(`[SERVER]: ${data.toString().trim()}`);
});

serverProcess.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Process complete JSON responses
function processResponses() {
  let newlineIndex;
  while ((newlineIndex = responseBuffer.indexOf('\n')) !== -1) {
    const responseStr = responseBuffer.substring(0, newlineIndex);
    responseBuffer = responseBuffer.substring(newlineIndex + 1);
    
    try {
      const response = JSON.parse(responseStr);
      handleResponse(response);
    } catch (error) {
      console.error('Error parsing response:', error);
    }
  }
}

// Queue for pending requests
const pendingRequests = new Map();
let currentRequestId = 1;

// Send a request to the server
function sendRequest(request) {
  return new Promise((resolve) => {
    const id = currentRequestId++;
    const requestWithId = { ...request, id };
    
    pendingRequests.set(id, resolve);
    serverProcess.stdin.write(JSON.stringify(requestWithId) + '\n');
  });
}

// Handle responses from the server
function handleResponse(response) {
  const resolve = pendingRequests.get(response.id);
  if (resolve) {
    pendingRequests.delete(response.id);
    resolve(response);
  }
}

// Store the conversation
async function storeConversation() {
  const request = {
    type: 'store_conversation',
    conversation_id: CONVERSATION_ID,
    messages: sampleConversation
  };
  
  const result = await sendRequest(request);
  console.log('Store conversation result:', result);
  return result;
}

// Get available tools
async function getTools() {
  const request = {
    type: 'list_tools'
  };
  
  const result = await sendRequest(request);
  console.log('Available tools:', result);
  return result;
}

// Execute a tool
async function executeTool(toolName, input) {
  console.log(`Executing tool: ${toolName}`);
  console.log('Input:', JSON.stringify(input, null, 2));
  
  const request = {
    type: 'execute_tool',
    tool: toolName,
    input,
    conversation_id: CONVERSATION_ID
  };
  
  const result = await sendRequest(request);
  console.log('Tool execution result:', JSON.stringify(result, null, 2));
  return result;
}

// Run the tests
async function runTests() {
  try {
    console.log('Starting tests...');
    
    // Store the conversation
    await storeConversation();
    
    // Get available tools
    await getTools();
    
    // Test groupByProperty operation
    await executeTool('knowledge_graph_manipulator', {
      operation: 'groupByProperty',
      targetGraphId: sampleArtifact.id,
      params: {
        propertyName: 'type'
      }
    });
    
    // Test highlightNodes operation
    await executeTool('knowledge_graph_manipulator', {
      operation: 'highlightNodes',
      targetGraphId: sampleArtifact.id,
      params: {
        nodeIds: ['node1', 'node3'],
        color: '#00ff00'
      }
    });
    
    // Test filterNodes operation
    await executeTool('knowledge_graph_manipulator', {
      operation: 'filterNodes',
      targetGraphId: sampleArtifact.id,
      params: {
        predicate: 'type',
        value: 'person'
      }
    });
    
    // Test resetView operation
    await executeTool('knowledge_graph_manipulator', {
      operation: 'resetView',
      targetGraphId: sampleArtifact.id,
      params: {}
    });
    
    console.log('Tests completed successfully!');
    
    // Clean up
    serverProcess.kill();
  } catch (error) {
    console.error('Test failed:', error);
    serverProcess.kill();
  }
}

// Run the tests
runTests(); 