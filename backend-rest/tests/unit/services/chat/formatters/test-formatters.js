/**
 * Response Formatter Adapter Test Script
 * 
 * This script tests each response formatter adapter implementation.
 */

import 'dotenv/config';
import { AnthropicResponseFormatterAdapter } from './src/server/services/chat/formatters/anthropic';
import { OpenAIResponseFormatterAdapter } from './src/server/services/chat/formatters/openai';
import { GeminiResponseFormatterAdapter } from './src/server/services/chat/formatters/gemini';

// Test a response formatter adapter
function testAdapter(name, adapterInstance) {
  console.log(`\n======= Testing ${name} Response Formatter Adapter =======`);
  
  try {
    // Test 1: Get tool definition
    console.log(`\n[${name}] Test 1: getResponseFormatterToolDefinition()`);
    const definition = adapterInstance.getResponseFormatterToolDefinition();
    console.log(`Tool definition structure:`, JSON.stringify(definition).substring(0, 100) + '...');
    
    // Test 2: Extract formatter output
    console.log(`\n[${name}] Test 2: extractFormatterOutput()`);
    
    // Create appropriate mock response for each provider
    let mockResponse;
    if (name === 'Anthropic') {
      mockResponse = {
        content: [
          { type: 'text', text: 'Processing your request' },
          {
            type: 'tool_use',
            name: 'response_formatter',
            id: 'tool_123',
            input: {
              thinking: 'Test thinking',
              conversation: [
                { type: 'text', content: 'Test content' }
              ]
            }
          }
        ]
      };
    } else if (name === 'OpenAI') {
      mockResponse = {
        choices: [{
          message: {
            tool_calls: [{
              function: {
                name: 'response_formatter',
                arguments: JSON.stringify({
                  thinking: 'Test thinking',
                  conversation: [
                    { type: 'text', content: 'Test content' }
                  ]
                })
              }
            }]
          }
        }]
      };
    } else if (name === 'Gemini') {
      mockResponse = {
        functionCalls: () => [{
          name: 'response_formatter',
          args: {
            thinking: 'Test thinking',
            conversation: [
              { type: 'text', content: 'Test content' }
            ]
          }
        }]
      };
    }
    
    const output = adapterInstance.extractFormatterOutput(mockResponse);
    console.log('Formatter output:', JSON.stringify(output).substring(0, 100) + '...');
    
    // Test 3: Convert to store format
    console.log(`\n[${name}] Test 3: convertToStoreFormat()`);
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
    
    const storeFormat = adapterInstance.convertToStoreFormat(formatterOutput);
    console.log('Store format has thinking:', storeFormat.thinking !== undefined);
    console.log('Store format conversation:', storeFormat.conversation.substring(0, 50) + '...');
    console.log('Number of artifacts:', storeFormat.artifacts?.length || 0);
    
    console.log(`\n✅ ${name} adapter tests passed`);
    return true;
  } catch (error) {
    console.error(`\n❌ ${name} adapter test failed:`, error);
    return false;
  }
}

async function runTests() {
  console.log('Response Formatter Adapter Test Script');
  console.log('===================================\n');
  
  const results = {};
  
  // Test Anthropic Adapter
  try {
    const anthropicAdapter = new AnthropicResponseFormatterAdapter();
    results.anthropic = testAdapter('Anthropic', anthropicAdapter);
  } catch (error) {
    console.error('Error initializing Anthropic adapter:', error);
    results.anthropic = false;
  }
  
  // Test OpenAI Adapter
  try {
    const openaiAdapter = new OpenAIResponseFormatterAdapter();
    results.openai = testAdapter('OpenAI', openaiAdapter);
  } catch (error) {
    console.error('Error initializing OpenAI adapter:', error);
    results.openai = false;
  }
  
  // Test Gemini Adapter
  try {
    const geminiAdapter = new GeminiResponseFormatterAdapter();
    results.gemini = testAdapter('Gemini', geminiAdapter);
  } catch (error) {
    console.error('Error initializing Gemini adapter:', error);
    results.gemini = false;
  }
  
  // Print summary
  console.log('\n======= Test Summary =======');
  Object.entries(results).forEach(([adapter, success]) => {
    console.log(`${adapter}: ${success ? '✅ PASSED' : '❌ FAILED'}`);
  });
}

// Run the tests
runTests().catch(error => {
  console.error('Test script error:', error);
  process.exit(1);
}); 