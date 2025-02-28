export type ArtifactType = 
  | 'code'
  | 'html'
  | 'image/svg+xml'
  | 'image/png'
  | 'text'
  | 'application/vnd.ant.mermaid'
  | 'text/markdown'
  | 'application/python'
  | 'application/javascript'
  | 'application/vnd.react'
  | 'application/vnd.bibliography'
  | 'application/vnd.ant.python'
  | 'application/vnd.knowledge-graph'
  | 'application/vnd.ant.knowledge-graph'
  | 'application/json'
  | 'application/vnd.ant.json';

export interface Artifact {
  id: string;           // Unique UUID for internal use
  artifactId: string;   // Original ID from XML
  type: ArtifactType;
  title: string;
  content: string;
  timestamp: Date;
  position: number;
  language?: string;
  sourceCode?: string;  // Optional source code for generated artifacts
  
  // New versioning fields for knowledge graphs
  previousVersionId?: string;  // ID of the previous version
  nextVersionId?: string;      // ID of the next version (if this isn't latest)
  versionNumber?: number;      // Sequential version number (1-based)
  versionLabel?: string;       // Optional descriptive label for this version
  versionTimestamp?: Date;     // When this specific version was created
  
  // For graph artifacts specifically
  graphMetadata?: {
    nodeCount?: number;
    edgeCount?: number;
    lastCommand?: string;      // Description of command that created this version
    commandParams?: Record<string, any>; // Parameters of the command
  };
}
