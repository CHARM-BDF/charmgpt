/**
 * LLM Provider Test Script
 * 
 * This script tests each LLM provider implementation in isolation.
 * Run with: ts-node src/server/services/llm/test-providers.ts
 */

import { AnthropicProvider } from './providers/anthropic';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';
import { LLMProvider, LLMProviderOptions } from './types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Test a provider with a simple prompt
 */
async function testProvider(
  name: string, 
  provider: LLMProvider, 
  options: LLMProviderOptions = {}
) {
  console.log(`\n======= Testing ${name} Provider =======`);
  
  try {
    console.log(`Sending test query to ${name}...`);
    
    const startTime = Date.now();
    const response = await provider.query(
      'Explain the difference between TypeScript and JavaScript in one sentence.', 
      options
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

/**
 * Run all provider tests
 */
async function runTests() {
  console.log('LLM Provider Test Script');
  console.log('======================\n');
  
  const results: Record<string, boolean> = {};
  
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