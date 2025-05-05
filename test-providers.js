/**
 * Test script for verifying the ChatService implementation with multiple providers
 * 
 * Run with: node test-providers.js
 */

const { LLMService } = require('./dist/server/services/llm');
const { ChatService } = require('./dist/server/services/chat');
const { AnthropicResponseFormatterAdapter } = require('./dist/server/services/chat/formatters/anthropic');
const { OpenAIResponseFormatterAdapter } = require('./dist/server/services/chat/formatters/openai');
const { GeminiResponseFormatterAdapter } = require('./dist/server/services/chat/formatters/gemini');

// Sample message to test with
const TEST_MESSAGE = "What is the capital of France?";

// Test each provider
async function testAllProviders() {
  console.log("==== Testing ChatService with Multiple Providers ====\n");
  
  // Create services
  const llmService = new LLMService();
  const chatService = new ChatService(llmService);
  
  // Get formatter adapters for testing
  const anthropicFormatter = new AnthropicResponseFormatterAdapter();
  const openaiFormatter = new OpenAIResponseFormatterAdapter();
  const geminiFormatter = new GeminiResponseFormatterAdapter();

  // Test each provider
  await testProvider(chatService, 'anthropic', anthropicFormatter);
  await testProvider(chatService, 'openai', openaiFormatter);
  await testProvider(chatService, 'gemini', geminiFormatter);
  
  console.log("\n==== Testing Complete ====");
}

// Test a specific provider
async function testProvider(chatService, provider, formatterAdapter) {
  console.log(`\n---- Testing ${provider.toUpperCase()} Provider ----\n`);
  
  try {
    console.log(`1. Getting tool definition for ${provider}...`);
    const toolDef = formatterAdapter.getResponseFormatterToolDefinition();
    console.log(`✅ Got tool definition: ${toolDef.name}`);
    
    console.log(`\n2. Testing LLM Service with ${provider}...`);
    const llmService = chatService.llmService;
    llmService.setProvider({ provider });
    
    // For basic query testing
    const providerName = llmService.getProvider();
    console.log(`✅ Provider set to: ${providerName}`);
    
    console.log(`\n3. Testing full ChatService processChat with ${provider}...`);
    console.log(`Sending message: "${TEST_MESSAGE}"`);
    
    const result = await chatService.processChat(
      TEST_MESSAGE,
      [], // empty history
      { modelProvider: provider },
      (status) => console.log(`    Status: ${status}`)
    );
    
    console.log('\n✅ Received response:');
    
    // Display partial response for verification
    if (result.thinking) {
      console.log(`\nThinking:\n${result.thinking.substring(0, 100)}...`);
    }
    
    if (result.conversation) {
      console.log(`\nConversation:\n${result.conversation.substring(0, 100)}...`);
    }
    
    if (result.artifacts && result.artifacts.length > 0) {
      console.log(`\nArtifacts: ${result.artifacts.length}`);
      console.log(`First artifact: ${result.artifacts[0].title} (${result.artifacts[0].type})`);
    }
    
    console.log(`\n✅ ${provider.toUpperCase()} TEST PASSED`);
  } catch (error) {
    console.error(`❌ ${provider.toUpperCase()} TEST FAILED:`, error);
  }
}

// Run tests
testAllProviders().catch(error => {
  console.error("Error running tests:", error);
}); 