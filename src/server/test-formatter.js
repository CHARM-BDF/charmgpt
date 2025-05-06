/**
 * Test script for response formatters
 * 
 * This script checks if the response formatters are correctly handling
 * responses from different LLM providers.
 */

// Import formatters
import { OpenAIResponseFormatterAdapter } from './services/chat/formatters/openai.js';
import { AnthropicResponseFormatterAdapter } from './services/chat/formatters/anthropic.js';

// Create sample OpenAI response
const openaiResponse = {
  choices: [{
    message: {
      content: "This is a test response without tool calls",
      // No tool_calls to simulate the error case
    }
  }]
};

// Create sample Anthropic response
const anthropicResponse = {
  content: [
    {
      type: 'text',
      text: "This is a test response without tool use"
      // No tool_use to simulate the error case
    }
  ]
};

console.log('=== TESTING RESPONSE FORMATTERS ===');

// Test OpenAI formatter
try {
  console.log('\n--- Testing OpenAI formatter ---');
  const openaiFormatter = new OpenAIResponseFormatterAdapter();
  const openaiOutput = openaiFormatter.extractFormatterOutput(openaiResponse);
  console.log('OpenAI formatter output:', JSON.stringify(openaiOutput, null, 2));
  const openaiStore = openaiFormatter.convertToStoreFormat(openaiOutput);
  console.log('OpenAI store format:', JSON.stringify(openaiStore, null, 2));
} catch (error) {
  console.error('OpenAI formatter error:', error);
}

// Test Anthropic formatter
try {
  console.log('\n--- Testing Anthropic formatter ---');
  const anthropicFormatter = new AnthropicResponseFormatterAdapter();
  const anthropicOutput = anthropicFormatter.extractFormatterOutput(anthropicResponse);
  console.log('Anthropic formatter output:', JSON.stringify(anthropicOutput, null, 2));
  const anthropicStore = anthropicFormatter.convertToStoreFormat(anthropicOutput);
  console.log('Anthropic store format:', JSON.stringify(anthropicStore, null, 2));
} catch (error) {
  console.error('Anthropic formatter error:', error);
}

console.log('\n=== TEST COMPLETE ==='); 