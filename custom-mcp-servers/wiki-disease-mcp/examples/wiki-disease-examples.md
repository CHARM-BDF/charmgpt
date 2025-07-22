# Wiki Disease MCP Examples

This document provides example usage of the Wiki Disease MCP tools.

## Example 1: Search for a Disease

### Request
```json
{
  "tool": "search-disease",
  "arguments": {
    "disease_name": "diabetes",
    "max_results": 5,
    "include_categories": true
  }
}
```

### Expected Response
The tool will return:
1. A text response with search results and summarization instructions
2. A markdown artifact containing formatted search results with titles, snippets, and categories

## Example 2: Get Detailed Disease Information

### Request
```json
{
  "tool": "get-disease-details",
  "arguments": {
    "page_title": "Diabetes mellitus",
    "sections": ["Signs and symptoms", "Causes", "Treatment"]
  }
}
```

### Expected Response
The tool will return:
1. A text response with extracted sections and summarization instructions
2. A markdown artifact containing the full formatted article sections

## Example 3: Browse Diseases by Category

### Request
```json
{
  "tool": "get-diseases-by-category",
  "arguments": {
    "category": "Infectious diseases",
    "max_results": 20
  }
}
```

### Expected Response
The tool will return:
1. A text response listing diseases with summarization instructions
2. A markdown artifact containing a formatted list of diseases with Wikipedia links

## Example Use Cases

### 1. Research a Specific Condition
```
User: "I need information about Type 2 diabetes symptoms and treatment options."

1. Use search-disease with "Type 2 diabetes" to find relevant articles
2. Use get-disease-details on "Diabetes mellitus type 2" to get full information
3. Extract specific sections like "Symptoms" and "Management"
```

### 2. Explore Related Conditions
```
User: "What are some common genetic disorders?"

1. Use get-diseases-by-category with "Genetic disorders"
2. Get a list of genetic conditions
3. Use get-disease-details on specific conditions of interest
```

### 3. Compare Similar Diseases
```
User: "What's the difference between Type 1 and Type 2 diabetes?"

1. Use search-disease with "diabetes types" to find relevant articles
2. Use get-disease-details on both "Diabetes mellitus type 1" and "Diabetes mellitus type 2"
3. Compare the "Causes" and "Pathophysiology" sections
```

## Integration with LLMs

The wiki-disease MCP is designed to work seamlessly with LLMs:

1. **Contextual Summarization**: Each response includes instructions for the LLM to summarize based on the conversation context
2. **Markdown Artifacts**: All data is returned as well-formatted markdown for easy reading
3. **Flexible Queries**: Tools support various search patterns and specific section extraction

## Error Handling

The MCP handles common errors gracefully:
- Invalid disease names return "No results found"
- Missing Wikipedia pages return appropriate error messages
- Rate limiting ensures respectful API usage (1 second between requests)

## Tips for Best Results

1. **Use Specific Disease Names**: More specific queries yield better results
2. **Check Categories**: Use categories to discover related conditions
3. **Extract Relevant Sections**: When using get-disease-details, specify the sections you need
4. **Follow Wikipedia Naming**: Use exact Wikipedia page titles for best results (you can find these from search results) 