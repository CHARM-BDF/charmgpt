import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import type { Node } from 'turndown';

interface ConvertToMarkdownArgs {
    html: string;
    preserveTables?: boolean;
}

interface ConvertToMarkdownResult {
    markdown: string;
}

type TurndownNode = Node & {
    textContent?: string;
    nodeName?: string;
    parentNode?: TurndownNode;
    isBlock?: boolean;
};

export async function convertToMarkdown(args: ConvertToMarkdownArgs): Promise<ConvertToMarkdownResult> {
    const { html, preserveTables = true } = args;

    // Initialize Turndown with GitHub Flavored Markdown support
    const turndownService = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '_',
        strongDelimiter: '**'  // Explicitly set strong delimiter
    });

    // Use GitHub Flavored Markdown plugin for tables and other GFM features
    turndownService.use(gfm);

    // Custom rule for complex tables
    turndownService.addRule('complexTables', {
        filter: (node: TurndownNode) => {
            return node.nodeName === 'TABLE';
        },
        replacement: (content: string, node?: TurndownNode) => {
            // If it's not a complex table (no colspan/rowspan), let GFM handle it
            if (!node || !hasComplexStructure(node)) {
                return content;
            }

            // For complex tables, preserve the HTML
            return `\n\n${getTableHTML(node)}\n\n`;
        }
    });

    // Helper function to check if table has complex structure
    function hasComplexStructure(node: TurndownNode): boolean {
        const table = node as unknown as HTMLTableElement;
        let hasComplex = false;

        // Check for colspan or rowspan in th and td elements
        const cells = table.getElementsByTagName('th');
        for (let i = 0; i < cells.length; i++) {
            if (cells[i].hasAttribute('colspan') || cells[i].hasAttribute('rowspan')) {
                hasComplex = true;
                break;
            }
        }

        if (!hasComplex) {
            const cells = table.getElementsByTagName('td');
            for (let i = 0; i < cells.length; i++) {
                if (cells[i].hasAttribute('colspan') || cells[i].hasAttribute('rowspan')) {
                    hasComplex = true;
                    break;
                }
            }
        }

        return hasComplex;
    }

    // Helper function to get clean HTML for complex tables
    function getTableHTML(node: TurndownNode): string {
        const table = node as unknown as HTMLTableElement;
        // Clean up the table HTML and preserve only essential attributes
        const cleanHTML = table.outerHTML
            .replace(/\s+/g, ' ')
            .replace(/>\s+</g, '><')
            .replace(/\s*=\s*/g, '=')
            .replace(/(<table[^>]*)style="[^"]*"/, '$1')
            .replace(/(<(?:tr|td|th)[^>]*)style="[^"]*"/, '$1');
        return cleanHTML;
    }

    // Custom rule for the title element
    turndownService.addRule('title', {
        filter: (node: TurndownNode) => {
            return node.nodeName === 'TITLE';
        },
        replacement: (content: string) => {
            const trimmed = content.trim().replace(/\s+/g, ' ');
            return `# ${trimmed}\n`;
        }
    });

    // Helper function to determine section level
    function getSectionLevel(text: string, element?: Element): number | null {
        // Check for specific HTML elements and classes
        if (element) {
            const className = element.getAttribute('class') || '';
            const tagName = element.tagName.toLowerCase();

            // Handle h1 elements and class='title' or heading1
            if (tagName === 'h1' || className.includes('title') || className.includes('heading1')) {
                return 1;
            }

            // Handle h2 elements
            if (tagName === 'h2') {
                return 2;
            }

            // Handle toc-link class
            if (className.includes('toc-link')) {
                return 2;
            }

            // Handle datalabel and heading4 classes - return 0 to indicate bold text
            if (className.includes('datalabel') || className.includes('heading4')) {
                return 0;
            }
        }

        // Return null for normal text
        return null;
    }

    // Custom rule for list items with bold text
    turndownService.addRule('listItemWithBold', {
        filter: (node: TurndownNode) => {
            if (node.nodeName !== 'LI') return false;
            const hasStrongChild = node.textContent?.includes('**') || false;
            return hasStrongChild;
        },
        replacement: (content: string, node?: TurndownNode) => {
            const trimmed = content.trim()
                .replace(/\\\*\*/g, '**')  // Fix escaped bold markers
                .replace(/\*\*([^*]+)\*\*\\?-/, '**$1** -')  // Fix escaped hyphens after bold
                .replace(/\s+/g, ' ');  // Normalize spaces

            if (!trimmed) return '';

            // Handle multi-bold items by splitting them
            const parts = trimmed.split(/(?<=\*\*[^*]+\*\*)(?=\s+\*\*)/);
            if (parts.length > 1) {
                return parts.map(part => `- ${part.trim()}`).join('\n');
            }

            return `- ${trimmed}`;
        }
    });

    // Custom rule for bold text
    turndownService.addRule('boldText', {
        filter: (node: TurndownNode) => {
            return node.nodeName === 'STRONG' || node.nodeName === 'B';
        },
        replacement: (content: string) => {
            const trimmed = content.trim();
            return trimmed ? `**${trimmed}**` : '';
        }
    });

    // Enhanced rule for section headers
    turndownService.addRule('sectionHeaders', {
        filter: (node: TurndownNode) => {
            if (!node.nodeName || !node.textContent) return false;
            
            // Check for explicit header tags
            if (node.nodeName.match(/^H[1-6]$/)) {
                // For h2 elements, check if they are true section headers
                if (node.nodeName === 'H2') {
                    const element = node as unknown as Element;
                    // Check for section header markers in name or id attributes
                    const name = element.getAttribute('name') || '';
                    const id = element.getAttribute('id') || '';
                    return name.startsWith('_Section') || id.startsWith('_Section');
                }
                return true;
            }
            
            // Check for div with header classes
            if (node.nodeName === 'DIV') {
                const className = (node as unknown as Element).getAttribute('class') || '';
                return className.includes('heading') || className.includes('title');
            }
            
            return false;
        },
        replacement: (content: string, node?: TurndownNode) => {
            const text = content.trim().replace(/^#+\s*/, '');  // Remove any existing header markers
            
            if (!node || !node.nodeName) return text;
            
            // Handle explicit header tags
            const nodeName = node.nodeName;
            if (nodeName.match(/^H[1-6]$/)) {
                const level = parseInt(nodeName.charAt(1));
                return `\n\n${'#'.repeat(level)} ${text}\n\n`;
            }
            
            // Handle div with header classes
            if (nodeName === 'DIV') {
                const className = (node as unknown as Element).getAttribute('class') || '';
                if (className.includes('heading1') || className.includes('title')) {
                    return `\n\n# ${text}\n\n`;
                }
                if (className.includes('heading2')) {
                    return `\n\n## ${text}\n\n`;
                }
                if (className.includes('heading3')) {
                    return `\n\n### ${text}\n\n`;
                }
                if (className.includes('heading4')) {
                    return `\n\n#### ${text}\n\n`;
                }
            }
            
            return text;
        }
    });

    // Ignore scripts and styles
    ['script', 'style'].forEach(tag => {
        turndownService.addRule(tag, {
            filter: (node: TurndownNode) => node.nodeName?.toLowerCase() === tag,
            replacement: () => ''
        });
    });

    try {
        const markdown = turndownService.turndown(html);

        // Minimal post-processing, just for basic cleanup
        const cleanedMarkdown = markdown
            .replace(/\n{3,}/g, '\n\n')
            .replace(/^\s+|\s+$/g, '')
            .replace(/^(#+)\s+(#+)\s+(#+)\s+/gm, (_, ...groups) => {
                const totalPounds = groups.slice(0, -2).join('').length;
                return '#'.repeat(totalPounds) + ' ';
            });

        return {
            markdown: cleanedMarkdown
        };
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`Failed to convert HTML to Markdown: ${error.message}`);
        }
        throw new Error(`Failed to convert HTML to Markdown: ${String(error)}`);
    }
} 