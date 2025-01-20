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

    // Handle code snippets with language attribute
    if (type?.startsWith('code/')) {
        return 'code';
    }

    // If no type is specified or type is 'text', default to text/markdown
    if (!type || type === 'text') {
        return 'text/markdown';
    }

    const normalizedType = type;

    if (validTypes.includes(normalizedType as ArtifactType)) {
        return normalizedType as ArtifactType;
    }

    // Default to text/markdown for unknown types
    return 'text/markdown';
}

export function parseXMLResponse(xmlString: string): XMLResponse {
    console.log('\nXML Parser: Starting to parse XML response:', {
        responseLength: xmlString.length,
        preview: xmlString.slice(0, 200) + '...'
    });

    // Create a DOM parser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Extract thinking content if present
    const thinkingElement = xmlDoc.querySelector('thinking');
    const thinking = thinkingElement?.textContent || undefined;
    console.log('XML Parser: Thinking content:', {
        hasThinking: !!thinking,
        thinkingPreview: thinking?.slice(0, 100)
    });

    // Extract conversation content
    const conversationElement = xmlDoc.querySelector('conversation');
    if (!conversationElement) {
        throw new Error('Response must contain a conversation element');
    }

    // Initialize artifacts array
    const artifacts: XMLArtifact[] = [];

    // Extract only artifacts that are direct children of the response element and after conversation
    const responseElement = xmlDoc.querySelector('response');
    console.log('XML Parser: Found response element:', {
        hasResponse: !!responseElement,
        childNodes: responseElement?.childNodes.length
    });

    if (responseElement) {
        let foundConversation = false;
        responseElement.childNodes.forEach((node, index) => {
            console.log(`XML Parser: Processing child node ${index}:`, {
                type: node.nodeType,
                nodeName: node.nodeName,
                isElement: node.nodeType === Node.ELEMENT_NODE,
                textContent: node.nodeType === Node.TEXT_NODE ? node.textContent?.trim() : undefined
            });

            if (node.nodeType === Node.ELEMENT_NODE) {
                const elem = node as Element;
                console.log('XML Parser: Processing element:', {
                    tagName: elem.tagName.toLowerCase(),
                    foundConversation,
                    attributes: {
                        type: elem.getAttribute('type'),
                        id: elem.getAttribute('id'),
                        title: elem.getAttribute('title')
                    }
                });

                if (elem.tagName.toLowerCase() === 'conversation') {
                    foundConversation = true;
                } else if (foundConversation && elem.tagName.toLowerCase() === 'artifact') {
                    const artifactType = elem.getAttribute('type');
                    // Use innerHTML for SVG content, textContent for everything else
                    const content = artifactType === 'image/svg+xml' ? elem.innerHTML : elem.textContent || '';
                    
                    console.log('XML Parser: Found artifact after conversation - FULL CONTENT:', {
                        type: artifactType,
                        id: elem.getAttribute('id'),
                        title: elem.getAttribute('title'),
                        contentLength: content.length,
                        content
                    });

                    artifacts.push({
                        type: validateArtifactType(artifactType),
                        id: elem.getAttribute('id') || crypto.randomUUID(),
                        title: elem.getAttribute('title') || 'Untitled',
                        content: content.trim()
                    });
                }
            }
        });
    }

    console.log('XML Parser: Extracted artifacts:', {
        count: artifacts.length,
        artifacts: artifacts.map(a => ({
            id: a.id,
            type: a.type,
            title: a.title,
            contentLength: a.content.length,
            contentPreview: a.content.slice(0, 50) + '...'
        }))
    });

    // Get conversation content, preserving markdown and keeping codesnip content inline
    let conversation = processConversationContent(conversationElement);
    console.log('XML Parser: Processed conversation content:', {
        contentLength: conversation.length,
        preview: conversation.slice(0, 100) + '...'
    });

    // If thinking exists, prepend it to the conversation with clear separation
    if (thinking) {
        conversation = `${thinking}\n\n---\n\n${conversation}`;
    }

    return {
        thinking,
        conversation,
        artifacts
    };
}

function processConversationContent(element: Element): string {
    let content = '';
    console.log('XML Parser: Processing conversation element:', {
        childNodes: element.childNodes.length
    });

    element.childNodes.forEach((node, index) => {
        console.log(`XML Parser: Processing conversation child node ${index}:`, {
            type: node.nodeType,
            nodeName: node.nodeName,
            isElement: node.nodeType === Node.ELEMENT_NODE,
            textContent: node.nodeType === Node.TEXT_NODE ? node.textContent?.trim() : undefined
        });

        if (node.nodeType === Node.TEXT_NODE) {
            // Preserve markdown formatting in text nodes
            content += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const elem = node as Element;
            console.log('XML Parser: Processing conversation element:', {
                tagName: elem.tagName.toLowerCase(),
                attributes: elem.getAttributeNames().reduce((acc, name) => ({
                    ...acc,
                    [name]: elem.getAttribute(name)
                }), {})
            });

            if (elem.tagName.toLowerCase() === 'ref') {
                const artifactId = elem.getAttribute('artifact');
                const description = elem.textContent;
                content += `\n[${description}](artifact:${artifactId})\n`;
            } else if (elem.tagName.toLowerCase() === 'code') {
                const language = elem.getAttribute('language') || '';
                const codeContent = elem.textContent || '';
                console.log('XML Parser: Found code block:', {
                    language,
                    contentLength: codeContent.length,
                    contentPreview: codeContent.slice(0, 50) + '...'
                });
                content += `\n\`\`\`${language}\n${codeContent}\n\`\`\`\n`;
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

// Add function to extract language from codesnip tags
export function extractCodeLanguage(type: string): string | undefined {
    if (type?.startsWith('code/')) {
        return type.split('/')[1];
    }
    return undefined;
} 