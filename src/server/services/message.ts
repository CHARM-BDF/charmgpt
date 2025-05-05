import crypto from 'crypto';
import { MCPArtifact } from '../../types/mcp';

// Types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
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
  conversation: string | Array<{
    type: string;
    content?: string;
    artifact?: {
      id: string;
      type: string;
      title: string;
      content: string;
      language?: string;
    };
  }>;
  artifacts?: Array<{
    id: string;
    artifactId?: string;
    type: string;
    title: string;
    content: string;
    position: number;
    language?: string;
    metadata?: Record<string, unknown>;
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
   * @deprecated Use enhanceResponseWithArtifacts instead
   * Format final response with bibliography
   */
  formatResponseWithBibliography(storeResponse: StoreFormat, bibliography?: any[]): StoreFormat {
    if (!bibliography) {
      return storeResponse;
    }

    console.log('\n🔴🔴🔴 LEGACY PATH: formatResponseWithBibliography called 🔴🔴🔴');
    console.log('Bibliography entries:', bibliography.length);
    
    // Use the new enhanceResponseWithArtifacts function
    const result = this.enhanceResponseWithArtifacts(
      storeResponse,
      [{
        type: "application/vnd.bibliography",
        title: "Article References",
        content: bibliography
      }]
    );
    
    console.log('🔴🔴🔴 LEGACY PATH: Bibliography processing complete 🔴🔴🔴');
    return result;
  }

  /**
   * @deprecated Use enhanceResponseWithArtifacts instead
   * Format final response with knowledge graph
   */
  formatResponseWithKnowledgeGraph(storeResponse: StoreFormat, knowledgeGraph?: any, title: string = "Knowledge Graph"): StoreFormat {
    console.log('\n=== FORMAT RESPONSE WITH KNOWLEDGE GRAPH ===');
    
    if (!knowledgeGraph) {
      console.log('No knowledge graph provided, returning original response');
      return storeResponse;
    }

    console.log(`Knowledge graph has ${knowledgeGraph.nodes?.length || 0} nodes and ${knowledgeGraph.links?.length || 0} links`);
    
    // Use the new enhanceResponseWithArtifacts function
    return this.enhanceResponseWithArtifacts(
      storeResponse,
      [{
        type: "application/vnd.knowledge-graph",
        title: title,
        content: knowledgeGraph
      }]
    );
  }

  /**
   * @deprecated Use enhanceResponseWithArtifacts instead
   * Format final response with markdown
   */
  formatResponseWithMarkdown(storeResponse: StoreFormat, grantMarkdown: any): StoreFormat {
    if (!grantMarkdown) {
      return storeResponse;
    }

    // Use the new enhanceResponseWithArtifacts function
    return this.enhanceResponseWithArtifacts(
      storeResponse,
      [{
        type: "text/markdown",
        title: grantMarkdown.title || "NIH Grant Details",
        content: grantMarkdown.content,
        language: "markdown"
      }]
    );
  }

  /**
   * Unified function to enhance a response with artifacts
   * Replaces the individual enhancement functions with a single, consistent approach
   * 
   * @param baseResponse - The current store response to enhance
   * @param artifacts - Array of artifacts to add to the response
   * @param appendButtons - Whether to append artifact buttons to the conversation text
   * @returns The enhanced response with all artifacts added
   */
  enhanceResponseWithArtifacts(
    baseResponse: StoreFormat, 
    artifacts: MCPArtifact[],
    appendButtons: boolean = true
  ): StoreFormat {
    console.log('\n🟢🟢🟢 NEW PATH: enhanceResponseWithArtifacts called 🟢🟢🟢');
    console.log(`Starting with ${baseResponse.artifacts?.length || 0} existing artifacts`);
    console.log(`Adding ${artifacts.length} new artifacts of types: ${artifacts.map(a => a.type).join(', ')}`);
    
    // Start with existing artifacts or empty array
    const existingArtifacts = baseResponse.artifacts || [];
    let position = existingArtifacts.length;
    
    // Process each artifact based on its type
    const processedArtifacts = artifacts.map(artifact => {
      // Generate an identifier based on the type and a unique ID
      const typeId = artifact.type.split('/').pop() || 'artifact';
      const artifactId = `${typeId}-${crypto.randomUUID()}`;
      
      console.log(`Processing ${artifact.type} artifact: "${artifact.title}"`);
      
      // Handle content formatting based on type
      const content = this.formatArtifactContent(artifact);
      
      // Check for metadata and log if present
      if (artifact.metadata) {
        console.log(`Artifact has metadata: ${Object.keys(artifact.metadata).join(', ')}`);
        if (artifact.metadata.sourceCode) {
          console.log(`Artifact has source code in metadata of length: ${(artifact.metadata.sourceCode as string).length}`);
        }
      }
      
      // Return the processed artifact with metadata preserved
      return {
        id: artifactId,
        artifactId: artifactId,
        type: artifact.type,
        title: artifact.title,
        content: content,
        position: position++,
        language: artifact.language,
        metadata: artifact.metadata // Preserve original metadata
      };
    });
    
    console.log(`Processed ${processedArtifacts.length} artifacts successfully`);
    
    // Handle conversation based on its type (string or array)
    if (typeof baseResponse.conversation === 'string') {
      // Legacy string format - add artifact buttons as text
      let conversation = baseResponse.conversation;
      
      if (appendButtons && processedArtifacts.length > 0) {
        const conversationAppends = processedArtifacts.map(artifact => 
          this.createArtifactButton(artifact.id, artifact.type, artifact.title)
        );
        conversation = `${conversation}\n\n${conversationAppends.join('\n\n')}`;
        console.log(`Added ${conversationAppends.length} artifact buttons to string conversation`);
      }
      
      // Return updated response with all artifacts
      return {
        ...baseResponse,
        conversation: conversation,
        artifacts: [...existingArtifacts, ...processedArtifacts]
      };
    } else if (Array.isArray(baseResponse.conversation)) {
      // New array format - add artifacts as elements
      let conversationArray = [...baseResponse.conversation];
      
      if (appendButtons && processedArtifacts.length > 0) {
        // Add each artifact as a new conversation item
        const artifactItems = processedArtifacts.map(artifact => ({
          type: 'artifact',
          artifact: {
            id: artifact.id,
            type: artifact.type,
            title: artifact.title,
            content: artifact.content,
            language: artifact.language
          }
        }));
        
        conversationArray = [...conversationArray, ...artifactItems];
        console.log(`Added ${artifactItems.length} artifact items to array conversation`);
      }
      
      // Return updated response with all artifacts
      return {
        ...baseResponse,
        conversation: conversationArray,
        artifacts: [...existingArtifacts, ...processedArtifacts]
      };
    } else {
      console.log('❌ Unexpected conversation format, returning with artifacts only');
      
      // Return with just the artifacts added
      return {
        ...baseResponse,
        artifacts: [...existingArtifacts, ...processedArtifacts]
      };
    }
  }
  
  /**
   * Format artifact content based on type
   * Different artifact types may need different content handling
   */
  private formatArtifactContent(artifact: MCPArtifact): string {
    // Check if content is a JSON string with nested content
    if (typeof artifact.content === 'string' && artifact.content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(artifact.content);
        // If it has a content property, use that instead
        if (parsed.content) {
          console.log('Found nested content in artifact, extracting inner content');
          return parsed.content;
        }
      } catch (e) {
        // Not valid JSON or no nested content, continue with normal processing
        console.log('Content looks like JSON but failed to parse:', e);
      }
    }
    
    // For binary types like images, preserve the content as-is
    if (artifact.type.startsWith('image/')) {
      return typeof artifact.content === 'string' 
        ? artifact.content 
        : String(artifact.content);
    }
    
    // For JSON-based types, ensure content is stringified
    if (
      artifact.type === 'application/vnd.knowledge-graph' || 
      artifact.type === 'application/vnd.bibliography' ||
      artifact.type === 'application/json'
    ) {
      return typeof artifact.content === 'string' 
        ? artifact.content 
        : JSON.stringify(artifact.content);
    }
    
    // For text-based types, ensure it's a string
    return typeof artifact.content === 'string' 
      ? artifact.content 
      : JSON.stringify(artifact.content);
  }
} 