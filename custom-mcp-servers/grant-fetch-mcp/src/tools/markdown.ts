import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

interface ConvertToMarkdownArgs {
  html: string;
  preserveTables?: boolean;
}

interface ConvertToMarkdownResult {
  markdown: string;
}

type TurndownNode = {
  textContent?: string;
  nodeName?: string;
  parentNode?: TurndownNode;
};

export async function convertToMarkdown(args: ConvertToMarkdownArgs): Promise<ConvertToMarkdownResult> {
  const { html, preserveTables = true } = args;

  // Initialize Turndown with GitHub Flavored Markdown support
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '_'
  });

  // Use GitHub Flavored Markdown plugin for tables and other GFM features
  turndownService.use(gfm);

  // Ignore scripts, styles, and comments
  ['script', 'style'].forEach(tag => {
    turndownService.addRule(tag, {
      filter: (node: TurndownNode) => node.nodeName?.toLowerCase() === tag,
      replacement: () => ''
    });
  });

  // Custom rules for grant-specific content
  turndownService.addRule('grantNumber', {
    filter: (node: TurndownNode): boolean => {
      const match = node.textContent?.match(/[A-Z]+-\d+-\d+/);
      return match !== null && match !== undefined;
    },
    replacement: (content: string): string => {
      return `**${content}**`;
    }
  });

  // Custom rule for contact information
  turndownService.addRule('contactInfo', {
    filter: (node: TurndownNode): boolean => {
      const text = node.textContent || '';
      return (
        text.includes('Phone:') ||
        text.includes('Email:') ||
        text.includes('Telephone:')
      );
    },
    replacement: (content: string): string => {
      return content.split('\n').map(line => line.trim()).join('\n');
    }
  });

  // Custom rule for section headers
  turndownService.addRule('sectionHeaders', {
    filter: (node: TurndownNode): boolean => {
      const text = node.textContent || '';
      return (
        node.nodeName === 'H1' ||
        node.nodeName === 'H2' ||
        node.nodeName === 'H3' ||
        text.match(/^Part \d+\./) !== null
      );
    },
    replacement: (content: string): string => {
      // Ensure proper spacing around headers
      return `\n\n# ${content.trim()}\n\n`;
    }
  });

  try {
    const markdown = turndownService.turndown(html);

    // Post-processing cleanup
    const cleanedMarkdown = markdown
      // Remove excessive blank lines
      .replace(/\n{3,}/g, '\n\n')
      // Ensure headers have space after #
      .replace(/^(#{1,6})([^ \n])/gm, '$1 $2')
      // Clean up table formatting if preserveTables is true
      .split('\n')
      .map((line: string) => {
        if (preserveTables && line.includes('|')) {
          return line.replace(/\s*\|\s*/g, ' | ').trim();
        }
        return line;
      })
      .join('\n')
      // Remove any remaining script-like content
      .replace(/\(function\(.*?\)\);?/gs, '')
      // Clean up any double spaces
      .replace(/ {2,}/g, ' ')
      // Clean up any lines that are just whitespace
      .replace(/^\s+$/gm, '')
      // Remove any remaining empty lines at the start
      .replace(/^\n+/, '')
      // Ensure only double line breaks between sections
      .replace(/\n{3,}/g, '\n\n');

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