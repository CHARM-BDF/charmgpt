import { ArtifactType } from './artifacts';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  thinking?: string;
}

export interface MessageWithThinking extends Message {
  thinking?: string;
  artifactId?: string;  // DO NOT REMOVE: Required for artifact linking
}

// New types for XML response parsing
export interface XMLResponse {
  thinking?: string;
  conversation: string;
  artifacts: XMLArtifact[];
}

export interface XMLArtifact {
  type: ArtifactType;
  id: string;           // Unique UUID for internal use
  artifactId: string;   // Original ID from XML
  title: string;
  content: string;
  position: number;
  language?: string;
}

export interface XMLRef {
  artifactId: string;
  description: string;
}
