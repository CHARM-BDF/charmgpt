import { ArtifactType } from './artifacts';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface MessageWithThinking extends Message {
  thinking?: string;
  artifactId?: string;
  isStreaming?: boolean;
}

export interface StreamingState {
  messageId: string | null;
  content: string;
  isComplete: boolean;
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
  sourceCode?: string;  // Optional source code for generated artifacts
}

export interface XMLRef {
  artifactId: string;
  description: string;
}
