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
  function getSectionLevel(text: string): number {
    const cleanText = text.replace(/^#+\s*/, '').trim();
    if (cleanText.match(/^Part \d+\./)) return 1;
    if (cleanText.match(/^Section [IVX]+\./)) return 2;
    if (cleanText.match(/^[A-Z1-9]\./)) return 3;
    if (cleanText.match(/^[a-z]\./)) return 4;
    return 2;
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
      const isHeader = node.nodeName.match(/^H[1-6]$/);
      const text = node.textContent.trim();
      const isSection = text.match(/^(?:#+\s*)?(Part \d+\.|Section [IVX]+\.|[A-Z1-9]\.|[a-z]\.)/i);
      return Boolean(isHeader || isSection);
    },
    replacement: (content: string, node?: TurndownNode) => {
      const text = content.trim().replace(/^#+\s*/, '');  // Remove any existing header markers
      let level: number;
      
      const nodeName = node?.nodeName;
      if (nodeName?.match(/^H[1-6]$/)) {
        level = parseInt(nodeName.charAt(1));
      } else {
        level = getSectionLevel(text);
      }
      
      return `\n\n${'#'.repeat(level)} ${text}\n\n`;
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