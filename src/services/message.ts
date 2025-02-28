import { Message, MessageWithThinking, ConversationItem } from '../types/chat';
import { Artifact } from '../types/artifacts';
import { v4 as uuidv4 } from 'uuid';
import { KnowledgeGraph } from '../utils/knowledgeGraphUtils';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text: string }>;
}

export interface ToolResponse {
  type: 'tool_use';
  name: string;
  input: {
    thinking?: string;
    conversation: Array<{
      type: 'text' | 'artifact';
      content?: string;
      metadata?: {
        hasBinaryOutput?: boolean;
        binaryType?: string;
        [key: string]: any;
      };
      artifact?: {
        type: string;
        id: string;
        title: string;
        content: string;
        language?: string;
      };
    }>;
  };
}

export interface StoreResponse {
  thinking?: string;
  conversation: string;
  artifacts?: Array<{
    id: string;
    artifactId?: string;
    type: string;
    title: string;
    content: string;
    position: number;
    language?: string;
  }>;
}

export class MessageService {
  convertChatMessages(messages: ChatMessage[]): { role: string; content: string | { type: "text"; text: string }[] }[] {
    return messages.map(m => {
      if (typeof m.content === 'string') {
        return { role: m.role, content: m.content };
      } else {
        // Convert each block to Anthropic's expected format
        return { role: m.role, content: m.content.map(block => ({ type: "text", text: block.text })) };
      }
    });
  }

  convertToStoreFormat(toolResponse: ToolResponse): StoreResponse {
    const conversation: string[] = [];
    const artifacts: Array<any> = [];
    let position = 0;

    if (Array.isArray(toolResponse.input.conversation)) {
      toolResponse.input.conversation.forEach((item: any) => {
        if (item.type === 'text' && item.content) {
          conversation.push(item.content);
          
          // Check for binary output metadata in the text content
          if (item.metadata?.hasBinaryOutput) {
            const binaryId = crypto.randomUUID();
            const sourceCodeId = crypto.randomUUID();
            
            if (item.metadata?.binaryType) {
              artifacts.push({
                id: binaryId,
                artifactId: binaryId,
                type: item.metadata.binaryType,
                title: `Generated ${item.metadata.binaryType.split('/')[1].toUpperCase()}`,
                content: item.metadata.content || '',
                position: position++,
              });

              conversation.push(`<button class="artifact-button text-sm text-blue-600 dark:text-blue-400 hover:underline" data-artifact-id="${binaryId}" data-artifact-type="${item.metadata.binaryType}" style="cursor: pointer; background: none; border: none; padding: 0;">📎 Generated ${item.metadata.binaryType.split('/')[1].toUpperCase()}</button>`);
            }

            if (item.metadata?.sourceCode) {
              artifacts.push({
                id: sourceCodeId,
                artifactId: sourceCodeId,
                type: 'application/vnd.ant.python',
                title: 'Source Code',
                content: item.metadata.sourceCode,
                language: 'python',
                position: position++
              });

              conversation.push(`<button class="artifact-button text-sm text-blue-600 dark:text-blue-400 hover:underline" data-artifact-id="${sourceCodeId}" data-artifact-type="application/vnd.ant.python" style="cursor: pointer; background: none; border: none; padding: 0;">📎 Source Code</button>`);
            }
          }
        } 
        else if (item.type === 'artifact' && item.artifact) {
          const uniqueId = crypto.randomUUID();
          const validatedType = this.validateArtifactType(item.artifact.type);
          
          artifacts.push({
            id: uniqueId,
            artifactId: uniqueId,
            type: validatedType,
            title: item.artifact.title,
            content: item.artifact.content,
            position: position++,
            language: item.artifact.language || (validatedType === 'application/vnd.ant.python' ? 'python' : undefined)
          });

          const buttonHtml = `<button class="artifact-button text-sm text-blue-600 dark:text-blue-400 hover:underline" data-artifact-id="${uniqueId}" data-artifact-type="${validatedType}" style="cursor: pointer; background: none; border: none; padding: 0;">📎 ${item.artifact.title}</button>`;
          conversation.push(buttonHtml);
        }
      });
    } else if (typeof toolResponse.input.conversation === 'string') {
      conversation.push(toolResponse.input.conversation);
    }

    return {
      thinking: toolResponse.input.thinking,
      conversation: conversation.join('\n\n'),
      artifacts: artifacts
    };
  }

  private validateArtifactType(type: string): string {
    const validTypes = [
      'code',
      'html',
      'image/svg+xml',
      'image/png',
      'text',
      'application/vnd.ant.mermaid',
      'text/markdown',
      'application/python',
      'application/javascript',
      'application/vnd.react',
      'application/vnd.bibliography',
      'application/vnd.ant.python',
      'application/vnd.knowledge-graph'
    ];

    // Handle application/vnd.ant.code type
    if (type?.startsWith('application/vnd.ant.code')) {
      return 'code';
    }

    // Handle code snippets with language attribute
    if (type?.startsWith('code/')) {
      return 'code';
    }

    // Handle binary types explicitly
    if (type === 'image/png') {
      return 'image/png';
    }

    // Handle knowledge graph type
    if (type === 'application/vnd.knowledge-graph') {
      return 'application/vnd.knowledge-graph';
    }

    // If no type is specified or type is 'text', default to text/markdown
    if (!type || type === 'text') {
      return 'text/markdown';
    }

    const normalizedType = type;

    if (validTypes.includes(normalizedType)) {
      return normalizedType;
    }

    // Default to text/markdown for unknown types
    return 'text/markdown';
  }

  /**
   * Formats a response with bibliography data by adding it as an artifact
   * 
   * @param response - The current response object
   * @param bibliography - The bibliography data to add
   * @returns The updated response with bibliography artifact
   */
  public formatResponseWithBibliography(
    response: StoreResponse, 
    bibliography: any[]
  ): StoreResponse {
    // Generate a unique ID for the bibliography
    const bibliographyId = `bib-${uuidv4()}`;
    
    // Add bibliography to artifacts
    const artifacts = response.artifacts || [];
    
    artifacts.push({
      id: bibliographyId,
      artifactId: bibliographyId,
      type: 'application/vnd.bibliography',
      title: 'Bibliography',
      content: JSON.stringify(bibliography),
      position: artifacts.length
    });
    
    // Return updated response
    return {
      ...response,
      artifacts
    };
  }

  /**
   * Formats a response with knowledge graph data by adding it as an artifact
   * 
   * @param response - The current response object
   * @param knowledgeGraph - The knowledge graph data to add
   * @param title - Optional title for the knowledge graph
   * @returns The updated response with knowledge graph artifact
   */
  public formatResponseWithKnowledgeGraph(
    response: StoreResponse,
    knowledgeGraph: KnowledgeGraph,
    title: string = 'Knowledge Graph'
  ): StoreResponse {
    // Generate a unique ID for the knowledge graph
    const graphId = `kg-${uuidv4()}`;
    
    // Add knowledge graph to artifacts
    const artifacts = response.artifacts || [];
    
    artifacts.push({
      id: graphId,
      artifactId: graphId,
      type: 'application/vnd.knowledge-graph',
      title: title,
      content: JSON.stringify(knowledgeGraph),
      position: artifacts.length
    });
    
    // Return updated response
    return {
      ...response,
      artifacts
    };
  }
} 