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
  | 'application/vnd.ant.python';

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
