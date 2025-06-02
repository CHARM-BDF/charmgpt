#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function debugResponse() {
  console.log('🔍 Debug MCP Response Format');
  console.log('=' .repeat(40));
  
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'find-connecting-path',
      arguments: {
        entity_a: 'NCBIGene:283635',
        entity_b: 'NCBIGene:28514'
      }
    }
  };
  
  const child = spawn('node', ['dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: __dirname
  });

  let responseData = '';
  let errorData = '';

  child.stdout.on('data', (data) => {
    responseData += data.toString();
  });

  child.stderr.on('data', (data) => {
    errorData += data.toString();
  });

  child.on('close', (code) => {
    console.log(`Exit code: ${code}`);
    console.log('');
    
    console.log('📤 Request sent:');
    console.log(JSON.stringify(request, null, 2));
    console.log('');
    
    console.log('📥 Raw stdout:');
    console.log(responseData);
    console.log('');
    
    if (errorData) {
      console.log('📥 Raw stderr:');
      console.log(errorData);
      console.log('');
    }
    
    console.log('🔍 Analyzing response lines:');
    const lines = responseData.trim().split('\n');
    lines.forEach((line, i) => {
      console.log(`Line ${i + 1}: ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`);
      
      try {
        const parsed = JSON.parse(line);
        console.log(`  ✅ Valid JSON - ID: ${parsed.id}, Has result: ${!!parsed.result}, Has error: ${!!parsed.error}`);
      } catch (e) {
        console.log(`  ❌ Invalid JSON: ${e.message}`);
      }
    });
    
    process.exit(0);
  });

  // Send the request
  child.stdin.write(JSON.stringify(request) + '\n');
  child.stdin.end();
}

debugResponse(); 