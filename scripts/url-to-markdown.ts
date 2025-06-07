#!/usr/bin/env tsx

import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

interface UrlContent {
  url: string;
  title: string;
  content: string;
  error?: string;
}

/**
 * Extract text content from HTML using simple regex patterns
 * This is a basic implementation - for production use, consider using a proper HTML parser
 */
function extractTextFromHtml(html: string): { title: string; content: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
  
  // Remove script and style elements
  let cleanHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleanHtml = cleanHtml.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove HTML tags and decode basic entities
  let text = cleanHtml.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  // Split into paragraphs (simple heuristic)
  const paragraphs = text.split(/\.\s+/)
    .map(p => p.trim())
    .filter(p => p.length > 20) // Filter out very short fragments
    .slice(0, 10); // Take first 10 paragraphs to avoid overwhelming output
  
  return {
    title: title.replace(/\s+/g, ' ').trim(),
    content: paragraphs.join('.\n\n')
  };
}

/**
 * Fetch content from a single URL
 */
async function fetchUrlContent(url: string): Promise<UrlContent> {
  try {
    console.log(`Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; URL-to-Markdown Bot/1.0)'
      },
      timeout: 10000 // 10 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const { title, content } = extractTextFromHtml(html);
    
    return {
      url,
      title,
      content
    };
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return {
      url,
      title: 'Error',
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Format content as markdown
 */
function formatAsMarkdown(urlContents: UrlContent[]): string {
  let markdown = '# URL Content Extraction Results\n\n';
  markdown += `*Generated on: ${new Date().toISOString()}*\n\n`;
  markdown += `**Total URLs processed:** ${urlContents.length}\n\n`;
  
  // Add table of contents
  markdown += '## Table of Contents\n\n';
  urlContents.forEach((content, index) => {
    const anchor = content.title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    markdown += `${index + 1}. [${content.title}](#${anchor})\n`;
  });
  markdown += '\n---\n\n';
  
  // Add content for each URL
  urlContents.forEach((content, index) => {
    markdown += `## ${content.title}\n\n`;
    markdown += `**Source:** [${content.url}](${content.url})\n\n`;
    
    if (content.error) {
      markdown += `❌ **Error:** ${content.error}\n\n`;
    } else if (content.content) {
      markdown += `${content.content}\n\n`;
    } else {
      markdown += `*No content extracted*\n\n`;
    }
    
    if (index < urlContents.length - 1) {
      markdown += '---\n\n';
    }
  });
  
  return markdown;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: tsx scripts/url-to-markdown.ts [options] <urls...>

Options:
  --file <path>     Read URLs from a file (one per line)
  --output <path>   Output file path (default: url-content.md)
  --help           Show this help message

Examples:
  tsx scripts/url-to-markdown.ts https://example.com https://another-site.com
  tsx scripts/url-to-markdown.ts --file urls.txt --output result.md
    `);
    process.exit(0);
  }
  
  let urls: string[] = [];
  let outputFile = 'url-content.md';
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help') {
      console.log(`
Usage: tsx scripts/url-to-markdown.ts [options] <urls...>

Options:
  --file <path>     Read URLs from a file (one per line)
  --output <path>   Output file path (default: url-content.md)
  --help           Show this help message

Examples:
  tsx scripts/url-to-markdown.ts https://example.com https://another-site.com
  tsx scripts/url-to-markdown.ts --file urls.txt --output result.md
      `);
      process.exit(0);
    } else if (arg === '--file') {
      const filePath = args[++i];
      if (!filePath) {
        console.error('Error: --file requires a file path');
        process.exit(1);
      }
      
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const fileUrls = fileContent
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));
        urls.push(...fileUrls);
      } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        process.exit(1);
      }
    } else if (arg === '--output') {
      outputFile = args[++i];
      if (!outputFile) {
        console.error('Error: --output requires a file path');
        process.exit(1);
      }
    } else if (arg.startsWith('http')) {
      urls.push(arg);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  
  if (urls.length === 0) {
    console.error('Error: No URLs provided');
    process.exit(1);
  }
  
  console.log(`Processing ${urls.length} URLs...`);
  console.log(`Output will be saved to: ${outputFile}`);
  
  // Fetch content from all URLs
  const urlContents = await Promise.all(
    urls.map(url => fetchUrlContent(url))
  );
  
  // Generate markdown
  const markdown = formatAsMarkdown(urlContents);
  
  // Write to file
  fs.writeFileSync(outputFile, markdown, 'utf-8');
  
  // Print summary
  const successful = urlContents.filter(c => !c.error).length;
  const failed = urlContents.filter(c => c.error).length;
  
  console.log(`\n✅ Processing complete!`);
  console.log(`📄 Output saved to: ${outputFile}`);
  console.log(`📊 Summary: ${successful} successful, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n❌ Failed URLs:');
    urlContents
      .filter(c => c.error)
      .forEach(c => console.log(`  - ${c.url}: ${c.error}`));
  }
}

// Run the script
main().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
}); 