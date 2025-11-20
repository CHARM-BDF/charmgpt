# Entity Extraction Test Script

This directory contains test scripts for testing the `addNodesAndEdgesFromText` tool from the graphmodePubTatorMCP server.

## Test Scripts

### `test-entity-extraction.js`

Main test script that:
1. Extracts entities from the provided text about "Brain-wide electrical spatiotemporal dynamics encode depression vulnerability"
2. If the text is too long or fails, automatically breaks it into smaller chunks
3. Cleans the text by removing markdown links, URLs, and HTML tags
4. Displays all extracted entities grouped by type (Gene, Disease, Chemical, etc.)
5. Shows any relationships found between entities

**Usage:**
```bash
node test-entity-extraction.js
```

### `test-simple-extraction.js`

Simple test script using the example from PubTator documentation to verify the API is working.

**Usage:**
```bash
node test-simple-extraction.js
```

## How It Works

The test scripts use the PubTator RESTful API endpoint (`/CBBresearch/Lu/Demo/RESTful/`) which is the same endpoint used by the MCP server's `addNodesAndEdgesFromText` tool.

### Process:

1. **Submit Text**: POST request to `/request.cgi` with:
   - `text`: The text to annotate
   - `bioconcept`: Comma-separated list of entity types (Gene, Disease, Chemical, etc.)

2. **Get Session ID**: The API returns a session ID that's used to poll for results

3. **Poll for Results**: POST request to `/retrieve.cgi` with the session ID
   - Returns 404 if results aren't ready yet (keep polling)
   - Returns BioC JSON format when ready

4. **Parse Results**: Extract entities and relations from the BioC JSON format

## Notes

- The PubTator RESTful API may have rate limits (max 3 requests per second according to documentation)
- Very long texts may need to be broken into chunks (the script uses 5000 character chunks)
- The API may return 400 errors for certain text formats or if the service is experiencing issues
- The test script includes error handling and will attempt to process chunks if the full text fails

## Expected Output

The script will display:
- Text length (original and cleaned)
- Number of chunks if text is split
- Progress for each chunk
- Entities found, grouped by type:
  - Gene
  - Disease  
  - Chemical
  - Species
  - etc.
- Relationships between entities (if found)
- Total counts

## Example Output

```
================================================================================
PubTator Entity Extraction Test
Testing entity extraction from text about depression vulnerability
================================================================================

Original text length: 4941 characters
Cleaned text length: 4941 characters

📝 Attempting to extract entities from full text...
Submitting text for annotation (4941 characters)...
✅ Results retrieved!

================================================================================
EXTRACTED ENTITIES
================================================================================

DISEASE (3):
  - major depressive disorder (ID: D003866)
  - depression (ID: D003866)
  - stress (ID: D013315)

GENE (5):
  - ESR1 (ID: 2099)
  - ...

Total entities found: 8
Unique entities: 8
```

## Troubleshooting

If you get 400 errors:
1. Try with shorter text first
2. Check if the PubTator service is available
3. Verify the text doesn't contain problematic characters
4. Wait a few seconds and retry (rate limiting)

The MCP server implementation (`addNodesAndEdgesFromText` tool) uses the same API endpoint and includes robust error handling and retry logic.





