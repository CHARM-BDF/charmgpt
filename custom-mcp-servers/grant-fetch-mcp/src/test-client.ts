import { spawn } from 'child_process';
import path from 'path';

const serverProcess = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', process.stderr]
});

// Helper function to send a request and get response
async function sendRequest(request: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const responseChunks: Buffer[] = [];
    
    serverProcess.stdout.on('data', (chunk) => {
      responseChunks.push(Buffer.from(chunk));
    });

    serverProcess.stdout.once('end', () => {
      const response = Buffer.concat(responseChunks).toString();
      try {
        resolve(JSON.parse(response));
      } catch (error) {
        reject(new Error(`Invalid JSON response: ${response}`));
      }
    });

    serverProcess.stdin.write(JSON.stringify(request) + '\n');
  });
}

async function testServer() {
  try {
    // Test the fetch_webpage tool
    console.log('Testing fetch_webpage tool...');
    const fetchResult = await sendRequest({
      jsonrpc: '2.0',
      method: 'callTool',
      params: {
        name: 'fetch_webpage',
        arguments: {
          url: 'https://grants.nih.gov/grants/guide/pa-files/PAR-25-140.html'
        }
      },
      id: 1
    });

    console.log('Fetch result:', fetchResult);

    // Test the html_to_markdown tool with the fetched content
    if (fetchResult.result?.content?.[0]?.text) {
      console.log('\nTesting html_to_markdown tool...');
      const markdownResult = await sendRequest({
        jsonrpc: '2.0',
        method: 'callTool',
        params: {
          name: 'html_to_markdown',
          arguments: {
            html: fetchResult.result.content[0].text,
            preserveTables: true
          }
        },
        id: 2
      });

      console.log('Markdown result:', markdownResult);
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up
    serverProcess.stdin.end();
    process.exit(0);
  }
}

testServer(); 