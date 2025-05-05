// Simple test script for Gemini Response Formatter Adapter

import { GeminiResponseFormatterAdapter } from '../gemini.js';

// Create the adapter
const adapter = new GeminiResponseFormatterAdapter();

console.log('Running tests for GeminiResponseFormatterAdapter...');

// Test 1: Get tool definition
console.log('\nTest 1: getResponseFormatterToolDefinition()');
const definition = adapter.getResponseFormatterToolDefinition();
console.log('Tool definition has functionDeclarations:', !!definition.functionDeclarations);
console.log('Tool name:', definition.functionDeclarations[0].name);

// Test 2: Extract formatter output
console.log('\nTest 2: extractFormatterOutput()');
// Mock Gemini response with function calls
const functionCallsMethod = () => [
  {
    name: 'response_formatter',
    args: {
      thinking: 'Test thinking',
      conversation: [
        { type: 'text', content: 'Test content' }
      ]
    }
  }
];

const mockResponse = {
  functionCalls: functionCallsMethod
};

try {
  const output = adapter.extractFormatterOutput(mockResponse);
  console.log('Output has thinking:', !!output.thinking);
  console.log('Output has conversation array:', Array.isArray(output.conversation));
  console.log('First conversation item type:', output.conversation[0].type);
} catch (err) {
  console.error('Error:', err.message);
}

// Test 3: Convert to store format
console.log('\nTest 3: convertToStoreFormat()');
const formatterOutput = {
  thinking: 'Test thinking',
  conversation: [
    { type: 'text', content: 'Text content' },
    { 
      type: 'artifact', 
      artifact: {
        type: 'text/markdown',
        title: 'Test artifact',
        content: '# Test content'
      }
    }
  ]
};

const storeFormat = adapter.convertToStoreFormat(formatterOutput);
console.log('Store format has thinking:', !!storeFormat.thinking);
console.log('Store format has conversation:', !!storeFormat.conversation);
console.log('Store format has artifacts:', !!storeFormat.artifacts);
console.log('Number of artifacts:', storeFormat.artifacts?.length);

console.log('\nAll tests completed!'); 