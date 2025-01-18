# Chat Data Flow Documentation

## Overview
This document describes the complete flow of chat data in the MCP (Model Control Protocol) application, from user input to display, including server interactions and data transformations.

## Claude Prompt Context
The system is designed to work with Claude, which has been prompted to structure its responses in XML format with specific tags:
- `<thinking>`: Optional internal reasoning/planning (displayed at message top)
- `<conversation>`: Main response content
- `<ref artifact="id">`: References to artifacts
- `<artifact>`: Generated content like code, diagrams, etc.

## Data Flow Sequence

### 1. Chat Submission
```mermaid
graph TD
    A[User Input] --> B[ChatStore.submitMessage]
    B --> C[Store Message in messages Array]
    C --> D[Send to Server]
```

#### Details:
- User message stored immediately with role='user'
- Generates unique message ID
- Updates UI to show pending state

### 2. Server Processing
```mermaid
graph TD
    A[Receive Request] --> B[Forward to Claude API]
    B --> C[Receive XML Response]
    C --> D[Return to Client]
```

#### Details:
- Maintains conversation context
- Ensures response is in expected XML format
- Handles any Claude API errors

### 3. XML Response Processing
```mermaid
graph TD
    A[Raw XML Response] --> B[parseXMLResponse]
    B --> C{Extract Components}
    C --> D[Thinking Content]
    C --> E[Conversation Content]
    C --> F[Artifacts]
    E --> G[Process References]
```

#### Component Processing:
a) **Thinking Content**:
   - Optional planning/reasoning text
   - Prepended to conversation with separator
   - Will be styled as blockquote in future

b) **Conversation Content**:
   - Main response text
   - Preserves whitespace and formatting
   - Processes special tags:
     - `<ref>` → `[description](artifact:id)`
     - `<code>` → Markdown code blocks

c) **Artifacts**:
   - Generated content (code, diagrams, etc.)
   - Each has:
     - Unique ID
     - Type (validated against allowed types)
     - Title
     - Content

### 4. Store Updates
```mermaid
graph TD
    A[Processed Response] --> B[ChatStore.handleResponse]
    B --> C[Update messages Array]
    B --> D[Store Artifacts]
    D --> E[Update selectedArtifact]
```

#### State Management:
- Messages array updated with assistant's response
- Artifacts stored separately in artifacts map
- References maintained for artifact linking
- Selected artifact updated if relevant

### 5. Display Rendering
```mermaid
graph TD
    A[ChatMessages Component] --> B[Message Display]
    B --> C[Format Content]
    B --> D[Artifact Links]
    D --> E[Artifact Viewer]
```

#### UI Components:
- Messages displayed with proper spacing/formatting
- References rendered as clickable links
- Artifacts accessible through reference links
- Thinking content shown at top of message

## Type Definitions

### Key Interfaces:
```typescript
interface XMLResponse {
  thinking?: string;
  conversation: string;
  artifacts: XMLArtifact[];
}

interface XMLArtifact {
  type: ArtifactType;
  id: string;
  title: string;
  content: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  artifactId?: string;
}
```

## Data Transformation Example

Raw XML:
```xml
<response>
  <thinking>Planning to create a diagram...</thinking>
  <conversation>Here's a flowchart <ref artifact="diagram1">System Flow</ref>
  </conversation>
  <artifact type="image/svg+xml" id="diagram1" title="System Flow">
    <svg>...</svg>
  </artifact>
</response>
```

Processed Output:
```typescript
{
  thinking: "Planning to create a diagram...",
  conversation: "Here's a flowchart [System Flow](artifact:diagram1)",
  artifacts: [{
    type: "image/svg+xml",
    id: "diagram1",
    title: "System Flow",
    content: "<svg>...</svg>"
  }]
}
```

## Error Handling
- XML parsing errors trigger error state
- Invalid artifact types default to 'text/markdown'
- Missing conversation element throws error
- Server errors handled in chat store

## Future Enhancements
- Markdown rendering for conversation content
- Blockquote styling for thinking content
- Enhanced artifact type validation
- Real-time artifact updates 