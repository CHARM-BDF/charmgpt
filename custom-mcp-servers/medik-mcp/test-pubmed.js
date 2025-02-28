// Import the getPubmedAbstract function from our compiled server code
import { getPubmedAbstract } from './dist/index.js';

async function main() {
  try {
    console.log("Testing getPubmedAbstract function directly...");
    
    // Test with a PubMed ID from the query results
    const params = {
      pubmed_id: "PMID:26372813"  // A PubMed ID from the previous query results
    };
    
    console.log("PubMed parameters:", params);
    
    // Call the getPubmedAbstract function directly
    const result = await getPubmedAbstract(params);
    
    console.log("PubMed abstract result:", JSON.stringify(result, null, 2));
    
    console.log("Test completed successfully!");
  } catch (error) {
    console.error("Error during test:", error);
  }
}

main(); 