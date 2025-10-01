# MCP Response Examples

This document shows examples of properly formatted MCP responses with different artifact types.

## Basic Markdown Response

```typescript
return {
  content: [
    {
      type: "text",
      text: `# Instructions for Response
When using this data:
1. Follow the structured format shown
2. Do not create additional artifacts
3. Reference the provided markdown artifact

Below is the formatted data:
${formattedContent}`
    }
  ],
  artifacts: [
    {
      type: 'text/markdown',
      title: 'API Results',  // Required for UI display
      name: 'results.md',
      content: formattedContent
    }
  ]
};
```

## Code Response

```typescript
return {
  content: [
    {
      type: "text",
      text: "Here is the generated Python script..."
    }
  ],
  artifacts: [
    {
      type: 'application/python',
      title: 'Data Processing Script',
      name: 'process_data.py',
      language: 'python',
      content: pythonCode
    }
  ]
};
```

## Multiple Artifacts

```typescript
return {
  content: [
    {
      type: "text",
      text: "Analysis results with both visualization and data..."
    }
  ],
  artifacts: [
    {
      type: 'text/markdown',
      title: 'Analysis Report',
      name: 'report.md',
      content: reportMarkdown
    },
    {
      type: 'application/vnd.ant.mermaid',
      title: 'Data Flow Diagram',
      name: 'flow.mermaid',
      content: mermaidDiagram
    },
    {
      type: 'application/json',
      title: 'Raw Data',
      name: 'data.json',
      content: jsonData
    }
  ]
};
```

## Bibliography Response

```typescript
return {
  content: [
    {
      type: "text",
      text: "Found relevant publications..."
    }
  ],
  artifacts: [
    {
      type: 'application/vnd.bibliography',
      title: 'Literature References',
      name: 'references.bib',
      content: [
        {
          authors: ["Smith, J.", "Jones, K."],
          title: "Example Paper",
          journal: "Journal of Examples",
          year: "2023",
          doi: "10.1234/example"
        }
      ]
    }
  ]
};
```

## Knowledge Graph Response

```typescript
return {
  content: [
    {
      type: "text",
      text: "Generated knowledge graph from data..."
    }
  ],
  artifacts: [
    {
      type: 'application/vnd.knowledge-graph',
      title: 'Data Relationships',
      name: 'graph.json',
      content: {
        nodes: [...],
        edges: [...],
        metadata: {...}
      }
    }
  ]
};
``` 