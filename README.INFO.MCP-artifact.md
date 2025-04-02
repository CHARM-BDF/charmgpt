# MCP Artifact Creation and Processing

This document explains how different MCP servers create artifacts and how they are processed by the chat system to display in the UI.

## Overview of Artifact Flow

1. MCP Server creates artifact(s)
2. Chat system processes and stores artifacts
3. Final response includes artifacts
4. UI displays artifact links in chat

## MCP Server Artifact Creation

### Bibliography (PubMed MCP)
```typescript
// PubMed MCP returns both LLM content and bibliography data
return {
  content: [{
    type: "text",
    text: `# Search Results for: ${formattedQuery}\n\n${markdownArticles.join("\n\n")}`,
    forModel: true  // This content goes to the LLM
  }],
  bibliography: bibliographyData,  // This becomes an artifact -array of citations
  isError: false
};
```

The PubMed MCP's return structure serves two purposes:
1. The `content` array contains formatted text marked as `forModel: true`, which gets sent to the LLM for analysis
2. The `bibliography` array contains structured citation data that gets turned into an artifact

This is different from the Grant Fetch MCP where the markdown content itself becomes the artifact, or the Knowledge Graph MCP where the graph data is directly returned as an artifact.

### Grant Fetch MCP
```typescript
// Grant Fetch MCP uses grantMarkdown
return {
  content: [{
    type: "text",
    text: llmVersion,
    forModel: true,
    metadata: {
      url: args.url,
      contentType: fetchResult.contentType,
      statusCode: fetchResult.statusCode
    }
  }],
  grantMarkdown: {
    type: "text/markdown",
    title: "NIH Grant Details",
    content: markdownResult.markdown,
    metadata: {
      source: args.url,
      contentType: fetchResult.contentType,
      convertedAt: new Date().toISOString()
    }
  },
  isError: false
};
```

### Knowledge Graph (Medik MCP)
```typescript
// Medik MCP uses artifacts array
return {
  content: [{
    type: "text",
    text: textContent
  }],
  artifacts: [{
    type: "application/vnd.knowledge-graph",
    id: randomUUID(),
    title: "Knowledge Graph",
    content: JSON.stringify(graphData)
  }],
  isError: false
};
```

## Chat System Processing

### Storage in Messages Object
Each type is stored differently in the messages object:

```typescript
// Bibliography
(messages as any).bibliography = toolResult.bibliography;

// Grant Markdown
(messages as any).grantMarkdown = toolResult.grantMarkdown;

// Knowledge Graph
(messages as any).knowledgeGraph = graphData;
```

### Final Response Formatting
Each type has its own formatter in MessageService:

```typescript
// Bibliography
formatResponseWithBibliography(storeResponse, bibliography) {
  artifacts.push({
    type: "application/vnd.bibliography",
    id: bibliographyId,
    title: "Article References",
    content: JSON.stringify(bibliography),
    position: artifacts.length
  });
}

// Grant Markdown
formatResponseWithMarkdown(storeResponse, grantMarkdown) {
  artifacts.push({
    type: "text/markdown",
    id: markdownId,
    title: grantMarkdown.title || "NIH Grant Details",
    content: grantMarkdown.content,
    position: artifacts.length,
    language: "markdown",
    metadata: grantMarkdown.metadata
  });
}

// Knowledge Graph
formatResponseWithKnowledgeGraph(storeResponse, knowledgeGraph) {
  artifacts.push({
    type: "application/vnd.knowledge-graph",
    id: graphId,
    title: title,
    content: JSON.stringify(knowledgeGraph),
    position: artifacts.length
  });
}
```

## Key Differences

1. **Return Structure**:
   - Bibliography: Returns as top-level `bibliography` array
   - Grant Markdown: Returns as top-level `grantMarkdown` object
   - Knowledge Graph: Returns in `artifacts` array

2. **Content Format**:
   - Bibliography: Array of citation objects
   - Grant Markdown: Plain markdown text with metadata
   - Knowledge Graph: JSON stringified graph data

3. **Artifact Types**:
   - Bibliography: `application/vnd.bibliography`
   - Grant Markdown: `text/markdown`
   - Knowledge Graph: `application/vnd.knowledge-graph`

4. **Metadata Handling**:
   - Bibliography: No metadata
   - Grant Markdown: Includes source, contentType, and timestamp
   - Knowledge Graph: No metadata

## Similarities

1. All types:
   - Get unique IDs via `crypto.randomUUID()`
   - Are added to the `artifacts` array in final response
   - Include a title and content
   - Have a position in the artifacts array

2. Processing:
   - All are stored in the `messages` object
   - All have dedicated formatter methods
   - All appear as links in the chat UI

## UI Display

The chat interface recognizes artifacts by their type and displays them as clickable links. The format is:

```html
<button class="artifact-button" data-artifact-id="${id}" data-artifact-type="${type}">
  📎 ${title}
</button>
```

This is created by the `createArtifactButton` method in MessageService.

## Best Practices

1. Always include:
   - Unique ID
   - Type
   - Title
   - Content
   - Position

2. Consider adding:
   - Metadata for context
   - Language specification if applicable
   - Source information

3. Use appropriate content format:
   - JSON.stringify for structured data
   - Plain text for markdown
   - Base64 for binary data 