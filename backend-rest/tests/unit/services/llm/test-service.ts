/**
 * LLM Service Test Script
 * 
 * This script tests the LLM service with different providers.
 * Run with: ts-node src/server/services/llm/test-service.ts
 */

import { LLMService } from '../../../../src/services/llm/index';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Test the LLM service with a specific provider
 */
async function testServiceWithProvider(
  service: LLMService, 
  providerName: string
) {
  console.log(`\n======= Testing LLM Service with ${providerName} Provider =======`);
  
  try {
    console.log(`Sending test query using ${providerName}...`);
    
    const startTime = Date.now();
    const response = await service.query({
      prompt: 'Explain the difference between TypeScript and JavaScript in one sentence.'
    });
    const duration = Date.now() - startTime;
    
    console.log(`✅ ${providerName} response received in ${duration}ms`);
    console.log('Content:', response.content);
    console.log('Token usage:', response.usage);
    
    // Get service stats
    const stats = service.getStats();
    console.log('Service stats:', stats);
    
    return true;
  } catch (error) {
    console.error(`❌ ${providerName} test failed:`, error);
    return false;
  }
}

/**
 * Test provider switching
 */
async function testProviderSwitching(service: LLMService) {
  console.log('\n======= Testing Provider Switching =======');
  
  const providers = ['anthropic', 'openai', 'gemini'];
  const availableProviders = providers.filter(provider => {
    const useVertexAI = !!process.env.GOOGLE_CLOUD_PROJECT;
    if (provider === 'anthropic') {
      return useVertexAI || !!process.env.ANTHROPIC_API_KEY;
    } else if (provider === 'openai') {
      return !!process.env.OPENAI_API_KEY;
    } else if (provider === 'gemini') {
      return useVertexAI || !!process.env.GEMINI_API_KEY;
    }
    return false;
  });
  
  if (availableProviders.length < 2) {
    console.log('⚠️ Need at least 2 API keys to test provider switching');
    return false;
  }
  
  try {
    // Start with first provider
    let currentProvider = availableProviders[0];
    console.log(`Starting with provider: ${currentProvider}`);
    service.setProvider({ provider: currentProvider as any });
    
    // Switch to second provider
    const nextProvider = availableProviders[1];
    console.log(`Switching to provider: ${nextProvider}`);
    service.setProvider({ provider: nextProvider as any });
    
    // Verify the provider was switched
    const stats = service.getStats();
    const success = stats.provider === nextProvider;
    
    if (success) {
      console.log(`✅ Successfully switched from ${currentProvider} to ${nextProvider}`);
      
      // Test a query with the new provider
      await service.query({
        prompt: 'What is the capital of France?'
      });
      
      console.log(`✅ Successfully queried with ${nextProvider} provider`);
    } else {
      console.error(`❌ Failed to switch provider: expected ${nextProvider}, got ${stats.provider}`);
    }
    
    return success;
  } catch (error) {
    console.error('❌ Provider switching test failed:', error);
    return false;
  }
}

/**
 * Run all service tests
 */
async function runTests() {
  console.log('LLM Service Test Script');
  console.log('======================\n');
  
  const results: Record<string, boolean> = {};
  
  // Initialize service with default provider (anthropic)
  let service = new LLMService();
  
  // Test with Anthropic if API key or Vertex AI is available
  const useVertexAI = !!process.env.GOOGLE_CLOUD_PROJECT;
  if (useVertexAI || process.env.ANTHROPIC_API_KEY) {
    service.setProvider({ provider: 'anthropic' });
    results.anthropic = await testServiceWithProvider(service, 'anthropic');
  } else {
    console.log('⚠️ Skipping Anthropic test (ANTHROPIC_API_KEY not set and GOOGLE_CLOUD_PROJECT not set)');
    results.anthropic = false;
  }
  
  // Test with OpenAI if API key is available
  if (process.env.OPENAI_API_KEY) {
    service.setProvider({ provider: 'openai' });
    results.openai = await testServiceWithProvider(service, 'openai');
  } else {
    console.log('⚠️ Skipping OpenAI test (OPENAI_API_KEY not set)');
    results.openai = false;
  }
  
  // Test with Gemini if API key or Vertex AI is available
  if (useVertexAI || process.env.GEMINI_API_KEY) {
    service.setProvider({ provider: 'gemini' });
    results.gemini = await testServiceWithProvider(service, 'gemini');
  } else {
    console.log('⚠️ Skipping Gemini test (GEMINI_API_KEY not set and GOOGLE_CLOUD_PROJECT not set)');
    results.gemini = false;
  }
  
  // Test provider switching
  results.switching = await testProviderSwitching(service);
  
  // Print summary
  console.log('\n======= Test Summary =======');
  Object.entries(results).forEach(([test, success]) => {
    console.log(`${test}: ${success ? '✅ PASSED' : '❌ FAILED'}`);
  });
}

// Run the tests
runTests().catch(error => {
  console.error('Test script error:', error);
  process.exit(1);
}); 