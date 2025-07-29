#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper binary path
const helperPath = join(__dirname, 'bin/CalendarHelper/CalendarHelper');

console.log('=== EventKit Calendar Helper Test ===');
console.log(`Current directory: ${__dirname}`);
console.log(`Helper path: ${helperPath}`);
console.log(`Helper exists: ${existsSync(helperPath) ? 'Yes' : 'No'}`);

if (!existsSync(helperPath)) {
  console.error('ERROR: Helper binary not found! Make sure you built it correctly.');
  process.exit(1);
}

// Test the helper 
console.log('\nRunning helper to list calendars...');

const helperProcess = spawn(helperPath, ['list-calendars'], { stdio: ['inherit', 'pipe', 'pipe'] });

helperProcess.stdout.on('data', (data) => {
  const output = data.toString().trim();
  console.log('\nOutput from helper:');
  console.log('-'.repeat(30));
  console.log(output);
  console.log('-'.repeat(30));
  
  try {
    const calendars = JSON.parse(output);
    console.log('\nParsed calendars:');
    console.log(JSON.stringify(calendars, null, 2));
    console.log(`Found ${calendars.length} calendars`);
  } catch (error) {
    console.log('\nFailed to parse JSON output:', error.message);
    console.log('Raw output:', output);
  }
});

helperProcess.stderr.on('data', (data) => {
  console.error('\nHelper STDERR:', data.toString());
});

helperProcess.on('close', (code) => {
  console.log(`\nHelper process exited with code ${code}`);
  
  if (code === 0) {
    console.log('SUCCESS: EventKit helper is working!');
  } else {
    console.error('ERROR: EventKit helper failed with code', code);
  }
}); 