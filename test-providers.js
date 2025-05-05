/**
 * LLM Provider Test Script
 * 
 * This script tests each LLM provider implementation in isolation.
 */

import 'dotenv/config';
import { AnthropicProvider } from './src/server/services/llm/providers/anthropic.js';
import { OpenAIProvider } from './src/server/services/llm/providers/openai.js';
import { GeminiProvider } from './src/server/services/llm/providers/gemini.js';

// Test a provider with a prompt
async function testProvider(name, providerInstance) {
  console.log(`\n======= Testing ${name} Provider =======`);
  
  try {
    console.log(`Sending test query to ${name}...`);
    
    const startTime = Date.now();
    const response = await providerInstance.query(
      'Explain the difference between TypeScript and JavaScript in one sentence.'
    );
    const duration = Date.now() - startTime;
    
    console.log(`✅ ${name} response received in ${duration}ms`);
    console.log('Content:', response.content);
    console.log('Token usage:', response.usage);
    
    return true;
  } catch (error) {
    console.error(`❌ ${name} test failed:`, error);
    return false;
  }
}

async function runTests() {
  console.log('LLM Provider Test Script');
  console.log('======================\n');
  
  const results = {};
  
  // Test Anthropic Provider
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropicProvider = new AnthropicProvider();
      results.anthropic = await testProvider('Anthropic', anthropicProvider);
    } catch (error) {
      console.error('Error initializing Anthropic provider:', error);
      results.anthropic = false;
    }
  } else {
    console.log('⚠️ Skipping Anthropic test (ANTHROPIC_API_KEY not set)');
    results.anthropic = false;
  }
  
  // Test OpenAI Provider
  if (process.env.OPENAI_API_KEY) {
    try {
      const openaiProvider = new OpenAIProvider();
      results.openai = await testProvider('OpenAI', openaiProvider);
    } catch (error) {
      console.error('Error initializing OpenAI provider:', error);
      results.openai = false;
    }
  } else {
    console.log('⚠️ Skipping OpenAI test (OPENAI_API_KEY not set)');
    results.openai = false;
  }
  
  // Test Gemini Provider
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiProvider = new GeminiProvider();
      results.gemini = await testProvider('Gemini', geminiProvider);
    } catch (error) {
      console.error('Error initializing Gemini provider:', error);
      results.gemini = false;
    }
  } else {
    console.log('⚠️ Skipping Gemini test (GEMINI_API_KEY not set)');
    results.gemini = false;
  }
  
  // Print summary
  console.log('\n======= Test Summary =======');
  Object.entries(results).forEach(([provider, success]) => {
    console.log(`${provider}: ${success ? '✅ PASSED' : '❌ FAILED'}`);
  });
}

// Run the tests
runTests().catch(error => {
  console.error('Test script error:', error);
  process.exit(1);
}); 