// Direct test script for mediKanren MCP server
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Import the server's request handlers
import { runQuery } from './dist/index.js';

async function main() {
  try {
    console.log("Testing runQuery function directly...");
    
    // Test parameters that are known to return results
    // Query for entities related to gastrointestinal stromal tumor
    const params = {
      e1: 'X->Known',
      e2: 'biolink:related_to',
      e3: 'MONDO:0011719'  // gastrointestinal stromal tumor
    };
    
    console.log("Query parameters:", params);
    
    // Call the runQuery function directly
    const result = await runQuery(params);
    
    console.log("Query result:", JSON.stringify(result, null, 2));
    
    console.log("Test completed successfully!");
  } catch (error) {
    console.error("Error during test:", error);
  }
}

main(); 