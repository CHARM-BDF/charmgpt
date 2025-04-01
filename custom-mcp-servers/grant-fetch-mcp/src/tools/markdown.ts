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
      .join('\n');

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