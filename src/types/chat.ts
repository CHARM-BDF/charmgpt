import { ArtifactType } from './artifacts';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  artifactId?: string;
}

// New types for XML response parsing
export interface XMLResponse {
  thinking?: string;
  conversation: string;
  artifacts: XMLArtifact[];
}

export interface XMLArtifact {
  type: ArtifactType;
  id: string;
  title: string;
  content: string;
}

export interface XMLRef {
  artifactId: string;
  description: string;
}
