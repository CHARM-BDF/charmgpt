export interface Artifact {
  id: string;
  type: 'code' | 'text' | 'html' | 'image/svg+xml' | 'application/vnd.ant.mermaid';
  title: string;
  content: string;
  timestamp: Date;
  messageId: string;
  language?: string;
}
