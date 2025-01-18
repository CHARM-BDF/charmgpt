import { XMLResponse, XMLArtifact, XMLRef } from '../types/chat';
import { ArtifactType } from '../types/artifacts';

function validateArtifactType(type: string | null): ArtifactType {
  const validTypes: ArtifactType[] = [
    'code',
    'html',
    'image/svg+xml',
    'text',
    'application/vnd.ant.mermaid',
    'text/markdown',
    'application/python',
    'application/javascript',
    'application/vnd.react'
  ];

  const normalizedType = type || 'text/markdown';
  
  if (validTypes.includes(normalizedType as ArtifactType)) {
    return normalizedType as ArtifactType;
  }
  
  return 'text/markdown';
}

export function parseXMLResponse(xmlString: string): XMLResponse {
  // Create a DOM parser
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  // Extract thinking content if present
  const thinkingElement = xmlDoc.querySelector('thinking');
  const thinking = thinkingElement?.textContent || undefined;

  // Extract conversation content
  const conversationElement = xmlDoc.querySelector('conversation');
  if (!conversationElement) {
    throw new Error('Response must contain a conversation element');
  }
  
  // Get conversation content, preserving markdown
  const conversation = processConversationContent(conversationElement);

  // Extract artifacts
  const artifacts: XMLArtifact[] = [];
  xmlDoc.querySelectorAll('artifact').forEach((artifactElement) => {
    artifacts.push({
      type: validateArtifactType(artifactElement.getAttribute('type')),
      id: artifactElement.getAttribute('id') || crypto.randomUUID(),
      title: artifactElement.getAttribute('title') || 'Untitled',
      content: artifactElement.textContent || ''
    });
  });

  console.log('\nXML Parser: Extracted Content:', {
    hasThinking: !!thinking,
    conversation: conversation.slice(0, 100) + '...',
    artifacts: artifacts.map(a => ({
      title: a.title,
      type: a.type,
      contentPreview: a.content.slice(0, 50) + '...'
    }))
  });

  return {
    thinking,
    conversation,
    artifacts
  };
}

function processConversationContent(element: Element): string {
  let content = '';
  
  element.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Preserve the original text with its whitespace
      content += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as Element;
      
      if (elem.tagName.toLowerCase() === 'ref') {
        const artifactId = elem.getAttribute('artifact');
        const description = elem.textContent;
        // Add newlines around refs to ensure they're on their own line
        content += `\n[${description}](artifact:${artifactId})\n`;
      } else if (elem.tagName.toLowerCase() === 'code') {
        const language = elem.getAttribute('language') || '';
        // Preserve code block formatting with consistent newlines
        content += `\n\`\`\`${language}\n${elem.textContent}\n\`\`\`\n`;
      }
    }
  });

  // Clean up multiple consecutive newlines but preserve intentional spacing
  return content
    .replace(/\n{3,}/g, '\n\n')  // Replace 3+ newlines with 2
    .trim();                      // Remove leading/trailing whitespace
}

export function extractReferences(content: string): XMLRef[] {
  const refs: XMLRef[] = [];
  const refRegex = /\[(.*?)\]\(artifact:(.*?)\)/g;
  let match;

  while ((match = refRegex.exec(content)) !== null) {
    refs.push({
      artifactId: match[2],
      description: match[1]
    });
  }

  return refs;
}

export function cleanConversationContent(content: string): string {
  return content;
} 