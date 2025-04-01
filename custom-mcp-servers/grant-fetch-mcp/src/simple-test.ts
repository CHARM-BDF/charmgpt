import { fetchWebPage } from './tools/fetch';
import { convertToMarkdown } from './tools/markdown';
import * as fs from 'fs/promises';
import * as path from 'path';

async function simpleTest() {
  try {
    // Step 1: Fetch the webpage
    console.log('Fetching NIH grant page...');
    const fetchResult = await fetchWebPage({ url: 'https://grants.nih.gov/grants/guide/pa-files/PAR-25-140.html' });
    
    console.log('\n=== HTML Response Details ===');
    console.log('Content Type:', fetchResult.contentType);
    console.log('Status Code:', fetchResult.statusCode);
    console.log('Content Length:', fetchResult.content.length);
    
    // Step 2: Convert to Markdown
    console.log('\nConverting to Markdown...');
    const markdownResult = await convertToMarkdown({
      html: fetchResult.content,
      preserveTables: true
    });

    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'output');
    await fs.mkdir(outputDir, { recursive: true });

    // Save both HTML and Markdown for comparison
    await fs.writeFile(path.join(outputDir, 'original.html'), fetchResult.content);
    await fs.writeFile(path.join(outputDir, 'converted.md'), markdownResult.markdown);

    console.log('\n=== Conversion Complete ===');
    console.log('Files saved in:', outputDir);
    console.log('- original.html:', fetchResult.content.length, 'bytes');
    console.log('- converted.md:', markdownResult.markdown.length, 'bytes');
    
    console.log('\n=== Markdown Preview (first 1000 chars) ===');
    console.log('-------------------');
    console.log(markdownResult.markdown.substring(0, 1000));
    console.log('-------------------');

  } catch (error) {
    console.error('Error:', error);
  }
}

simpleTest(); 