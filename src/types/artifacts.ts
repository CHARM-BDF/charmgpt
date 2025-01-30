export type ArtifactType = 
  | 'code'
  | 'html'
  | 'image/svg+xml'
  | 'text'
  | 'application/vnd.ant.mermaid'
  | 'text/markdown'
  | 'application/python'
  | 'application/javascript'
  | 'application/vnd.react';

export interface Artifact {
  id: string;           // Unique UUID for internal use
  artifactId: string;   // Original ID from XML
  type: ArtifactType;
  title: string;
  content: string;
  timestamp: Date;
  position: number;
  language?: string;
}
