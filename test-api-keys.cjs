/**
 * Direct LLM API Test Script
 * 
 * This script tests API keys by making direct API calls to each provider
 * without requiring transpiled code.
 */

require('dotenv').config();
const { Anthropic } = require('@anthropic-ai/sdk');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testAnthropicAPI() {
  console.log('\n======= Testing Anthropic API =======');
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⚠️ Skipping Anthropic test (ANTHROPIC_API_KEY not set)');
    return false;
  }
  
  try {
    console.log('Initializing Anthropic client...');
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    console.log('Sending test query to Claude...');
    const startTime = Date.now();
    
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [
        { role: 'user', content: 'Explain the difference between TypeScript and JavaScript in one sentence.' }
      ],
    });
    
    const duration = Date.now() - startTime;
    const content = response.content[0].text;
    
    console.log(`✅ Claude response received in ${duration}ms`);
    console.log('Response:', content);
    
    return true;
  } catch (error) {
    console.error('❌ Anthropic API test failed:', error);
    return false;
  }
}

async function testOpenAIAPI() {
  console.log('\n======= Testing OpenAI API =======');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️ Skipping OpenAI test (OPENAI_API_KEY not set)');
    return false;
  }
  
  try {
    console.log('Initializing OpenAI client...');
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    console.log('Sending test query to GPT-4...');
    const startTime = Date.now();
    
    const response = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      max_tokens: 100,
      messages: [
        { role: 'user', content: 'Explain the difference between TypeScript and JavaScript in one sentence.' }
      ],
    });
    
    const duration = Date.now() - startTime;
    const content = response.choices[0].message.content;
    
    console.log(`✅ GPT-4 response received in ${duration}ms`);
    console.log('Response:', content);
    
    return true;
  } catch (error) {
    console.error('❌ OpenAI API test failed:', error);
    return false;
  }
}

async function testGeminiAPI() {
  console.log('\n======= Testing Google Gemini API =======');
  
  if (!process.env.GEMINI_API_KEY) {
    console.log('⚠️ Skipping Gemini test (GEMINI_API_KEY not set)');
    return false;
  }
  
  try {
    console.log('Initializing Gemini client...');
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    console.log('Sending test query to Gemini...');
    const startTime = Date.now();
    
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Explain the difference between TypeScript and JavaScript in one sentence.' }] }],
      generationConfig: {
        maxOutputTokens: 100,
      },
    });
    
    const duration = Date.now() - startTime;
    const response = result.response;
    const content = response.text();
    
    console.log(`✅ Gemini response received in ${duration}ms`);
    console.log('Response:', content);
    
    return true;
  } catch (error) {
    console.error('❌ Gemini API test failed:', error);
    return false;
  }
}

async function runTests() {
  console.log('Direct LLM API Test Script');
  console.log('======================\n');
  
  const results = {
    anthropic: await testAnthropicAPI(),
    openai: await testOpenAIAPI(),
    gemini: await testGeminiAPI()
  };
  
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