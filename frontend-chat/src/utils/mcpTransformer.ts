import { MCPResponse } from '../types/mcp';
import { FormatterInput } from '../types/chat';

function getIconForType(type: string): string {
  switch (type) {
    case 'text/markdown':
      return '📝';
    case 'application/vnd.ant.code':
    case 'code':
      return '💻';
    case 'image/svg+xml':
    case 'image/png':
      return '🖼️';
    case 'application/vnd.mermaid':
      return '📊';
    case 'text/html':
      return '🌐';
    case 'application/vnd.react':
      return '⚛️';
    case 'application/vnd.bibliography':
      return '📚';
    default:
      return '📎';
  }
}

function formatTitle(type: string, customTitle?: string): string {
  if (customTitle) return customTitle;
  
  const baseType = type.split('/').pop()?.split('.').pop() || type;
  return `${baseType.charAt(0).toUpperCase()}${baseType.slice(1)} Content`;
}

export function transformMCPResponse(mcpResponse: MCPResponse): FormatterInput {
  const response: FormatterInput = {
    conversation: []
  };

  // Add initial text content if present
  if (mcpResponse.content?.[0]?.text) {
    response.conversation.push({
      type: 'text',
      content: mcpResponse.content[0].text
    });
  }

  // Process binary outputs (like images with source code)
  if (mcpResponse.binaryOutput) {
    const artifactId = crypto.randomUUID();
    response.conversation.push({
      type: 'artifact',
      artifact: {
        id: artifactId,
        artifactId: artifactId, // Maintain compatibility with existing code
        type: mcpResponse.binaryOutput.type,
        title: formatTitle(mcpResponse.binaryOutput.type),
        content: mcpResponse.binaryOutput.data,
        sourceCode: mcpResponse.binaryOutput.metadata.sourceCode,
        language: 'python',
        position: response.conversation.length,
        buttonProps: {
          className: 'artifact-button',
          icon: getIconForType(mcpResponse.binaryOutput.type)
        }
      }
    });
  }

  // Process additional content items that might contain artifacts
  mcpResponse.content.slice(1).forEach((item: MCPResponse['content'][0], index: number) => {
    if (item.metadata?.hasBinaryOutput) {
      const artifactId = crypto.randomUUID();
      response.conversation.push({
        type: 'artifact',
        artifact: {
          id: artifactId,
          artifactId: artifactId,
          type: item.metadata.binaryType || 'application/octet-stream',
          title: formatTitle(item.metadata.binaryType || 'Binary Content'),
          content: item.text,
          position: response.conversation.length,
          buttonProps: {
            className: 'artifact-button',
            icon: getIconForType(item.metadata.binaryType || '')
          }
        }
      });
    } else {
      // Regular text content
      response.conversation.push({
        type: 'text',
        content: item.text
      });
    }
  });

  // Format the response as markdown with artifact buttons
  const formattedResponse = response.conversation.map((item: FormatterInput['conversation'][0]) => {
    if (item.type === 'artifact' && item.artifact) {
      const { id, type, title, buttonProps } = item.artifact;
      return `\n<button 
        class="${buttonProps?.className || 'artifact-button'} text-sm text-blue-600 dark:text-blue-400 hover:underline"
        data-artifact-id="${id}"
        data-artifact-type="${type}"
      >${buttonProps?.icon || '📎'} ${title}</button>\n`;
    }
    return item.content;
  }).join('\n\n');

  // Return the final formatted response
  return {
    conversation: [{
      type: 'text',
      content: formattedResponse
    }]
  };
} 