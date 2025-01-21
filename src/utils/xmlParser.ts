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

// Add helper function to extract content from elements
function extractContent(elem: Element, useInnerHTML: boolean = false): string {
    if (useInnerHTML) {
        return elem.innerHTML.trim();
    }
    
    // Handle CDATA sections
    const cdataContent = Array.from(elem.childNodes)
        .filter(node => node.nodeType === Node.CDATA_SECTION_NODE)
        .map(node => node.textContent)
        .join('');
        
    if (cdataContent) {
        return cdataContent.trim();
    }
    
    return elem.textContent?.trim() || '';
}

export function parseXMLResponse(xmlString: string): XMLResponse {
    console.log('\n=== XML Parser: Input ===');
    console.log(xmlString);

    // Create a DOM parser
    const parser = new DOMParser();
    
    // Pre-process CDATA sections for code content
    const processedXML = xmlString.replace(
        /(<(thinking|conversation|artifact)(?:\s+[^>]*)?>)([\s\S]*?)(<\/\2>)/g,
        (_match, openTag, _tagName, content, closeTag) => {
            return `${openTag}<![CDATA[${content}]]>${closeTag}`;
        }
    );
    
    const xmlDoc = parser.parseFromString(processedXML, 'text/xml');

    // Extract thinking content if present
    const thinkingElement = xmlDoc.querySelector('thinking');
    const thinking = thinkingElement ? extractContent(thinkingElement) : undefined;

    // Extract conversation content
    const conversationElement = xmlDoc.querySelector('conversation');
    if (!conversationElement) {
        throw new Error('Response must contain a conversation element');
    }

    // Get raw conversation content without thinking content
    const conversationContent = extractContent(conversationElement);

    // Initialize artifacts array
    const artifacts: XMLArtifact[] = [];

    // Extract artifacts from the response
    const responseElement = xmlDoc.querySelector('response');
    if (responseElement) {
        const artifactElements = responseElement.getElementsByTagName('artifact');
        Array.from(artifactElements).forEach((elem) => {
            const artifactType = elem.getAttribute('type');
            const content = artifactType === 'image/svg+xml' 
                ? extractContent(elem, true)  // use innerHTML for SVG
                : extractContent(elem);       // handle CDATA for other types

            artifacts.push({
                type: validateArtifactType(artifactType),
                id: elem.getAttribute('id') || crypto.randomUUID(),
                title: elem.getAttribute('title') || 'Untitled',
                content: content.trim(),
                language: elem.getAttribute('language') || undefined
            });
        });
    }

    // Log the content parts for debugging
    console.log('\n=== Content Parts ===');
    console.log('Thinking:', thinking);
    console.log('Raw Conversation:', conversationContent);

    const result = {
        thinking,
        conversation: conversationContent,
        artifacts
    };

    console.log('\n=== XML Parser: Output ===');
    console.log(JSON.stringify(result, null, 2));

    return result;
}

function processConversationContent(element: Element): string {
    let content = '';
    
    function processNode(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            // Only return text if it's not just whitespace
            return text.trim() ? text : '';
        }
        
        if (node.nodeType === Node.ELEMENT_NODE) {
            const elem = node as Element;
            const tagName = elem.tagName.toLowerCase();
            
            switch (tagName) {
                case 'ref': {
                    const artifactId = elem.getAttribute('artifact');
                    const label = elem.getAttribute('label') || elem.textContent;
                    return `\n[${label}](artifact:${artifactId})\n`;
                }
                case 'code':
                case 'codesnip': {
                    const codeContent = elem.textContent?.trim() || '';
                    const language = elem.getAttribute('language') || '';
                    return `\n\`\`\`${language}\n${codeContent}\n\`\`\`\n`;
                }
                case 'thinking': {
                    // Skip thinking content when processing conversation
                    return '';
                }
                default: {
                    // Process all child nodes and combine their content
                    const childContent = Array.from(elem.childNodes)
                        .map(child => processNode(child))
                        .join('');
                    return childContent.trim() ? childContent : '';
                }
            }
        }
        
        return '';
    }
    
    // Process all child nodes and combine their content
    content = Array.from(element.childNodes)
        .map(node => processNode(node))
        .filter(text => text.trim()) // Remove empty strings
        .join('\n');

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