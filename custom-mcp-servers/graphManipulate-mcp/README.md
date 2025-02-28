# GraphManipulate MCP Server

This is a custom MCP (Multi-Channel Processing) server for knowledge graph manipulation. It provides tools for manipulating knowledge graphs through natural language requests processed by Claude.

## Features

- Group nodes by property
- Highlight specific nodes
- Filter nodes based on property values
- Reset graph view to original state
- Versioning of graph manipulations

## Setup

1. Install dependencies:

```bash
npm install
```

2. Build the TypeScript code:

```bash
npm run build
```

3. The server is designed to run as a stdio-based MCP server, which means it communicates through standard input/output streams rather than HTTP. It will be automatically started by the MCP service when needed.

## Testing

Run the test script to verify the server functionality:

```bash
npm test
```

This will:
1. Start the server as a child process
2. Create a sample knowledge graph
3. Store it in the conversation context
4. Test various graph manipulation operations
5. Shut down the server when tests are complete

## Communication Protocol

The server uses a JSON-based protocol over stdio:

### Request Types

#### List Tools

```json
{
  "id": 1,
  "type": "list_tools"
}
```

#### Execute Tool

```json
{
  "id": 2,
  "type": "execute_tool",
  "tool": "knowledge_graph_manipulator",
  "input": {
    "operation": "groupByProperty",
    "targetGraphId": "graph-id",
    "params": {
      "propertyName": "type"
    }
  },
  "conversation_id": "conversation-id"
}
```

#### Store Conversation

```json
{
  "id": 3,
  "type": "store_conversation",
  "conversation_id": "conversation-id",
  "messages": [
    {
      "role": "assistant",
      "artifacts": [
        {
          "id": "graph-id",
          "type": "application/vnd.ant.knowledge-graph",
          "content": "{\"nodes\":[...],\"links\":[...]}"
        }
      ]
    }
  ]
}
```

### Response Format

All responses include the request ID and relevant data:

```json
{
  "id": 2,
  "content": [
    {
      "type": "text",
      "text": "Successfully applied groupByProperty to the knowledge graph."
    }
  ],
  "artifacts": [
    {
      "id": "new-graph-id",
      "type": "application/vnd.ant.knowledge-graph",
      "content": "..."
    }
  ]
}
```

## Supported Operations

### groupByProperty

Groups nodes by a specified property.

**Parameters:**
- `propertyName`: The property to group by

### highlightNodes

Highlights specific nodes with a color.

**Parameters:**
- `nodeIds`: Array of node IDs to highlight
- `color`: (Optional) Color to use for highlighting (default: "#ff0000")

### filterNodes

Filters nodes based on a property value.

**Parameters:**
- `predicate`: The property to filter on
- `value`: The value to match

### resetView

Resets the graph view to its original state.

**Parameters:** None

## Integration with Claude

To use this MCP server with Claude, include the following in your system prompt:

```
When the user asks to manipulate a knowledge graph:
1. Identify the current graph artifact ID from the conversation context
2. Determine the appropriate operation (groupByProperty, filterNodes, highlightNodes, resetView)
3. Extract relevant parameters from the user's request
4. Call the knowledge_graph_manipulator tool with the correct parameters
5. Explain the changes made to the graph in your response

Example operations:
- "Group nodes by type" → groupByProperty with propertyName="type"
- "Show only person nodes" → filterNodes with predicate="type", value="person"
- "Highlight nodes 1, 2, and 3 in red" → highlightNodes with nodeIds=["1","2","3"], color="#ff0000"
- "Reset the graph view" → resetView
```

## Example Usage

```javascript
// Client-side code
const sendMessage = async (message) => {
  // If the message is about manipulating the graph, include the graph ID
  let enhancedMessage = message;
  if (
    knowledgeGraphArtifact && 
    (message.includes('graph') || message.includes('node') || message.includes('group'))
  ) {
    enhancedMessage = `${message} (referring to the knowledge graph with ID: ${knowledgeGraphArtifact.id})`;
  }
  
  // Send the message to the server
  await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: enhancedMessage,
      history: chatHistory
    })
  });
}; 