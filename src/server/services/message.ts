import crypto from 'crypto';

// Types
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text: string }>;
}

export interface AnthropicMessage {
  role: string;
  content: string | { type: "text"; text: string }[];
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
  binaryOutput?: {
    type: string;
    data: string;
    metadata: {
      size?: number;
      sourceCode?: string;
      [key: string]: any;
    };
  };
}

export interface StoreFormat {
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
  /**
   * Convert chat messages to Anthropic's format
   */
  convertChatMessages(messages: ChatMessage[]): AnthropicMessage[] {
    return messages.map(m => {
      if (typeof m.content === 'string') {
        return { role: m.role, content: m.content };
      } else {
        return { 
          role: m.role, 
          content: m.content.map(block => ({ type: "text", text: block.text }))
        };
      }
    });
  }

  /**
   * Convert tool response to store format
   */
  convertToStoreFormat(toolResponse: ToolResponse): StoreFormat {
    const conversation: string[] = [];
    const artifacts: Array<any> = [];
    let position = 0;

    if (Array.isArray(toolResponse.input.conversation)) {
      toolResponse.input.conversation.forEach((item: any) => {
        if (item.type === 'text' && item.content) {
          conversation.push(item.content);
          
          // Handle binary output if present in metadata
          if (item.metadata?.hasBinaryOutput && toolResponse.binaryOutput) {
            const binaryId = crypto.randomUUID();
            const sourceCodeId = crypto.randomUUID();
            
            // Add binary artifact
            artifacts.push({
              id: binaryId,
              artifactId: binaryId,
              type: toolResponse.binaryOutput.type,
              title: `Generated ${toolResponse.binaryOutput.type.split('/')[1].toUpperCase()}`,
              content: toolResponse.binaryOutput.data,
              position: position++,
            });

            // Add source code if available
            if (toolResponse.binaryOutput.metadata?.sourceCode) {
              artifacts.push({
                id: sourceCodeId,
                artifactId: sourceCodeId,
                type: 'application/vnd.ant.python',
                title: 'Source Code',
                content: toolResponse.binaryOutput.metadata.sourceCode,
                language: 'python',
                position: position++
              });
            }

            // Add buttons for artifacts
            conversation.push(this.createArtifactButton(binaryId, toolResponse.binaryOutput.type, `Generated ${toolResponse.binaryOutput.type.split('/')[1].toUpperCase()}`));
            
            if (toolResponse.binaryOutput.metadata?.sourceCode) {
              conversation.push(this.createArtifactButton(sourceCodeId, 'application/vnd.ant.python', 'Source Code'));
            }
          }
        } 
        else if (item.type === 'artifact' && item.artifact) {
          const uniqueId = crypto.randomUUID();
          
          // Add artifact
          artifacts.push({
            id: uniqueId,
            artifactId: uniqueId,
            type: item.artifact.type,
            title: item.artifact.title,
            content: item.artifact.content,
            position: position++,
            language: item.artifact.language
          });

          // Add button for artifact
          conversation.push(this.createArtifactButton(uniqueId, item.artifact.type, item.artifact.title));
        }
      });
    } else if (typeof toolResponse.input.conversation === 'string') {
      conversation.push(toolResponse.input.conversation);
    }

    return {
      thinking: toolResponse.input.thinking,
      conversation: conversation.join('\n\n'),
      artifacts: artifacts.length > 0 ? artifacts : undefined
    };
  }

  /**
   * Create HTML button for artifact
   */
  private createArtifactButton(id: string, type: string, title: string): string {
    return `<button class="artifact-button text-sm text-blue-600 dark:text-blue-400 hover:underline" data-artifact-id="${id}" data-artifact-type="${type}" style="cursor: pointer; background: none; border: none; padding: 0;">📎 ${title}</button>`;
  }

  /**
   * Format final response with bibliography
   */
  formatResponseWithBibliography(storeResponse: StoreFormat, bibliography?: any[]): StoreFormat {
    if (!bibliography) {
      return storeResponse;
    }

    const bibliographyId = crypto.randomUUID();
    const artifacts = storeResponse.artifacts || [];
    
    artifacts.push({
      id: bibliographyId,
      artifactId: bibliographyId,
      type: "application/vnd.bibliography",
      title: "Article References",
      content: JSON.stringify(bibliography),
      position: artifacts.length
    });

    return {
      ...storeResponse,
      artifacts
    };
  }
} 