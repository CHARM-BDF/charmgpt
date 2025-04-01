import { fetchWebPage } from './tools/fetch.js';
import { convertToMarkdown } from './tools/markdown.js';
import fs from 'fs/promises';
import path from 'path';

async function testGrantFetch() {
  const url = 'https://grants.nih.gov/grants/guide/pa-files/PAR-25-140.html';
  
  console.log('Fetching webpage...');
  try {
    // Fetch the webpage
    const fetchResult = await fetchWebPage({ url });
    console.log(`Fetch successful! Status: ${fetchResult.statusCode}`);
    console.log(`Content type: ${fetchResult.contentType}`);
    console.log(`Content length: ${fetchResult.content.length} characters`);

    // Save the raw HTML for inspection
    await fs.writeFile(
      path.join(process.cwd(), 'test-output', 'raw.html'),
      fetchResult.content
    );
    console.log('Raw HTML saved to test-output/raw.html');

    // Convert to Markdown
    console.log('\nConverting to Markdown...');
    const markdownResult = await convertToMarkdown({
      html: fetchResult.content,
      preserveTables: true
    });

    // Save the markdown
    await fs.writeFile(
      path.join(process.cwd(), 'test-output', 'converted.md'),
      markdownResult.markdown
    );
    console.log('Markdown saved to test-output/converted.md');

    // Print some stats
    console.log(`\nConversion Stats:`);
    console.log(`Original HTML length: ${fetchResult.content.length}`);
    console.log(`Markdown length: ${markdownResult.markdown.length}`);
    
    // Print a sample of the markdown
    console.log('\nFirst 500 characters of markdown:');
    console.log('----------------------------------------');
    console.log(markdownResult.markdown.slice(0, 500));
    console.log('----------------------------------------');

  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

// Create output directory if it doesn't exist
fs.mkdir(path.join(process.cwd(), 'test-output'), { recursive: true })
  .then(() => testGrantFetch())
  .catch(console.error); 