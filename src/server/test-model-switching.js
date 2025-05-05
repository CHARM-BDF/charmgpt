/**
 * Model Switching Test
 * 
 * This script tests the LLMService's ability to properly handle model switching
 * between different providers, ensuring that model names are properly updated.
 */

// Import the LLMService
import { LLMService } from './services/llm/index.js';

// Create a new LLM service with default options (Anthropic/Claude)
const llmService = new LLMService();

// Log the initial state
console.log('=== INITIAL STATE ===');
console.log(`Provider: ${llmService.getProvider()}`);
console.log(`Stats: ${JSON.stringify(llmService.getStats(), null, 2)}`);
console.log();

// Test switching to OpenAI
console.log('=== SWITCHING TO OPENAI ===');
llmService.setProvider({
  provider: 'openai',
});
console.log(`Provider after switch: ${llmService.getProvider()}`);
console.log(`Stats after switch: ${JSON.stringify(llmService.getStats(), null, 2)}`);
console.log();

// Test switching to Gemini
console.log('=== SWITCHING TO GEMINI ===');
llmService.setProvider({
  provider: 'gemini',
});
console.log(`Provider after switch: ${llmService.getProvider()}`);
console.log(`Stats after switch: ${JSON.stringify(llmService.getStats(), null, 2)}`);
console.log();

// Test switching back to Anthropic
console.log('=== SWITCHING BACK TO ANTHROPIC ===');
llmService.setProvider({
  provider: 'anthropic',
});
console.log(`Provider after switch: ${llmService.getProvider()}`);
console.log(`Stats after switch: ${JSON.stringify(llmService.getStats(), null, 2)}`);
console.log();

// Test with explicit model override
console.log('=== TESTING EXPLICIT MODEL OVERRIDE ===');
llmService.setProvider({
  provider: 'openai',
  model: 'gpt-4o', // Explicitly set model
});
console.log(`Provider after override: ${llmService.getProvider()}`);
console.log(`Stats after override: ${JSON.stringify(llmService.getStats(), null, 2)}`);
console.log();

console.log('Test complete! Check the logs above to verify that the model was updated correctly when switching providers.'); 