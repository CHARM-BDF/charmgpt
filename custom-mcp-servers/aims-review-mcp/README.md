# NIH Specific Aims Review MCP

This MCP server provides an AI-powered review service for NIH grant Specific Aims sections using Anthropic's Claude model. It analyzes the Specific Aims in the context of the funding opportunity announcement (FOA) and provides detailed feedback and recommendations.

## Features

- Comprehensive review of Specific Aims sections
- Analysis of impact, significance, innovation, and approach
- Alignment check with FOA requirements
- Structured feedback with strengths and weaknesses
- Preliminary score suggestion
- Markdown-formatted review output

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with your Anthropic API key:
```
ANTHROPIC_API_KEY=your_api_key_here
PORT=3000  # Optional, defaults to 3000
```

3. Build the TypeScript code:
```bash
npm run build
```

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### Health Check
```
GET /health
```
Returns server status.

### List Tools
```
GET /tools
```
Returns available tools (review_specific_aims).

### Review Specific Aims
```
POST /tools/review_specific_aims
```

Request body:
```json
{
  "aims_text": "Your specific aims text here",
  "rfa_text": "Your FOA/RFA text here"
}
```

Response format:
```json
{
  "content": [{
    "type": "text",
    "text": "Review completed successfully. Click the attachment to view the detailed review.",
    "forModel": true
  }],
  "artifacts": [{
    "type": "text/markdown",
    "id": "unique-id",
    "title": "NIH Specific Aims Review",
    "content": "Detailed review in markdown format",
    "metadata": {
      "generatedAt": "timestamp",
      "model": "claude-3-sonnet-20240229"
    }
  }],
  "isError": false
}
```

## Review Criteria

The AI reviewer evaluates:

1. Overall Impact and Significance
   - Problem importance
   - Potential field advancement

2. Innovation and Approach
   - Novelty of approaches
   - Method reasoning
   - Problem anticipation

3. Specific Aims Structure and Clarity
   - Clarity and achievability
   - Project coherence
   - Writing quality

4. FOA Alignment
   - Requirement fulfillment
   - Funding mechanism alignment

## Error Handling

The server provides detailed error messages for:
- Missing or invalid input parameters
- API authentication issues
- Review generation failures

## Development

To modify the review criteria or prompt, edit the `REVIEW_PROMPT` constant in `src/index.ts`.

## Integration

This MCP server integrates with the main chat system, providing:
- Markdown-formatted review artifacts
- Structured feedback
- Error handling
- Progress logging 