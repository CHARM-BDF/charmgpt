import { Artifact, ArtifactType } from '@charm-mcp/shared';

export interface FileAttachment {
  id: string;          // File UUID from storage
  name: string;        // Display name
  size: number;        // File size in bytes
  type: string;        // MIME type
  varName?: string;    // Variable name for code execution
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: FileAttachment[];  // File attachments
}

export interface StatusUpdate {
  id: string;
  message: string;
  timestamp: Date;
}

export interface MessageWithThinking extends Message {
  thinking?: string;
  artifactId?: string;  // Kept for backward compatibility
  artifactIds?: string[]; // Array of all artifact IDs associated with this message
  isStreaming?: boolean;
  statusUpdatesCollapsed?: boolean; // Controls visibility of status updates
  statusUpdates?: StatusUpdate[]; // Changed from string to StatusUpdate[]
  isLastStatusUpdate?: boolean;
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

export interface ButtonProps {
  className?: string;
  icon?: string;
}

export interface ConversationItem {
  type: 'text' | 'artifact';
  content?: string;
  artifact?: Artifact;
}

export interface FormatterInput {
  conversation: ConversationItem[];
}

export interface ConversationMetadata {
  id: string;
  name: string;
  lastUpdated: Date;
  created: Date;
  messageCount: number;
  projectId?: string; // Optional - not all conversations belong to projects
}

export interface Conversation {
  metadata: ConversationMetadata;
  messages: MessageWithThinking[];
  artifacts: Artifact[];
}

export interface ConversationState {
  currentConversationId: string | null;
  conversations: {
    [id: string]: Conversation;
  };
}
