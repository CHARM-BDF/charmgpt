import { XMLResponse, XMLArtifact, XMLRef } from '../types/chat';
import { ArtifactType } from '../types/artifacts';

/**
 * Validates and converts a string to ArtifactType
 * DO NOT REMOVE: Required for type safety
 */
function validateArtifactType(type: string): ArtifactType {
    const validTypes: ArtifactType[] = [
        'code',
        'html',
        'image/svg+xml',
        'text',
        'application/vnd.ant.mermaid',
        'text/markdown',
        'application/python',
        'application/javascript',
        'application/vnd.react',
        'application/vnd.bibliography'
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

// Helper function to extract content from elements
function extractContent(elem: Element, useInnerHTML: boolean = false): string {
    let content = '';
    
    if (useInnerHTML) {
        content = elem.innerHTML.trim();
    } else {
        // Handle CDATA sections
        const cdataContent = Array.from(elem.childNodes)
            .filter(node => node.nodeType === Node.CDATA_SECTION_NODE)
            .map(node => node.textContent)
            .join('');
            
        if (cdataContent) {
            content = cdataContent.trim();
        } else {
            content = elem.textContent?.trim() || '';
        }
    }

    // Replace backtick placeholders with actual backticks
    return content
        .replace(/\[TRIPLE_BACKTICK\]/g, '```')
        .replace(/\\`\\`\\`/g, '```')  // Handle escaped backticks
        .replace(/\[BACKTICK\]/g, '`');
}

// Helper function to clean backticks
function cleanBackticks(content: string): string {
    return content
        .replace(/\[TRIPLE_BACKTICK\]/g, '```')
        .replace(/\\`\\`\\`/g, '```')
        .replace(/\[BACKTICK\]/g, '`');
}

/**
 * CRITICAL: XML Response Parser
 * This function parses the AI's XML response into structured data
 * It extracts:
 * 1. Thinking process
 * 2. Conversation content
 * 3. Artifacts with their metadata
 */
export async function parseXMLResponse(xmlString: string) {
    console.log('\n=== XML Parser: Input ===');
    console.log(xmlString);

    // Extract thinking content
    const thinkingMatch = xmlString.match(/<thinking>([\s\S]*?)<\/thinking>/);
    const thinking = thinkingMatch ? thinkingMatch[1].trim() : '';

    // Extract conversation content
    const conversationMatch = xmlString.match(/<conversation>([\s\S]*?)<\/conversation>/);
    let conversation = conversationMatch ? conversationMatch[1].trim() : '';

    // Extract artifacts
    const artifacts: XMLArtifact[] = [];
    const artifactRegex = /<artifact\s+type="([^"]+)"\s+id="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/artifact>/g;
    
    let artifactMatch;
    let position = 0;
    while ((artifactMatch = artifactRegex.exec(xmlString)) !== null) {
        const [fullMatch, type, originalId, title, content] = artifactMatch;
        const uniqueId = crypto.randomUUID();
        artifacts.push({
            type: validateArtifactType(type),
            id: uniqueId,           // Unique ID for internal use
            artifactId: originalId, // Original ID from XML
            title,
            content: content.trim(),
            position: position,
            language: type.split('/')[1] || undefined
        });

        // Replace artifact XML with a button that includes data attributes and inline styles
        const buttonHtml = `<button class="artifact-button text-sm text-blue-600 dark:text-blue-400 hover:underline" data-artifact-id="${uniqueId}" data-artifact-type="${type}" style="cursor: pointer; background: none; border: none; padding: 0;">📎 ${title}</button>`;
        conversation = conversation.replace(fullMatch, buttonHtml);
        position++;
    }

    const result = {
        thinking,
        conversation,
        artifacts
    };

    console.log('\n=== XML Parser: Output ===');
    console.log(JSON.stringify(result, null, 2));

    return result;
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

export function extractCodeLanguage(type: string): string | undefined {
    if (type?.startsWith('code/')) {
        return type.split('/')[1];
    }
    return undefined;
} 