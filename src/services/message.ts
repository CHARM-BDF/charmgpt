import { Message, MessageWithThinking, ConversationItem } from '../types/chat';
import { Artifact } from '../types/artifacts';

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

  convertToStoreFormat(toolResponse: ToolResponse): {
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
  } {
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

  formatResponseWithBibliography(response: any, bibliography: any[]): any {
    const bibliographyId = crypto.randomUUID();
    response.artifacts = response.artifacts || [];
    response.artifacts.push({
      id: bibliographyId,
      artifactId: bibliographyId,
      type: "application/vnd.bibliography",
      title: "Article References",
      content: JSON.stringify(bibliography),
      position: response.artifacts.length
    });
    return response;
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
      'application/vnd.ant.python'
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
} 