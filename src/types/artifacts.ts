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
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  timestamp: Date;
  messageId: string;
  language?: string;
}
