/**
 * LLM Tool Calling Format Test
 * 
 * This script tests the tool calling formats for each LLM provider.
 */

require('dotenv').config();
const { Anthropic } = require('@anthropic-ai/sdk');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Sample tool definition for OpenAI
const calculatorToolOpenAI = {
  type: "function",
  function: {
    name: "calculator",
    description: "A basic calculator that can perform arithmetic operations",
    parameters: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["add", "subtract", "multiply", "divide"],
          description: "The arithmetic operation to perform"
        },
        a: {
          type: "number",
          description: "The first number"
        },
        b: {
          type: "number",
          description: "The second number"
        }
      },
      required: ["operation", "a", "b"]
    }
  }
};

// For Claude the format is different
const calculatorToolClaude = {
  name: "calculator",
  description: "A basic calculator that can perform arithmetic operations",
  input_schema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["add", "subtract", "multiply", "divide"],
        description: "The arithmetic operation to perform"
      },
      a: {
        type: "number",
        description: "The first number"
      },
      b: {
        type: "number",
        description: "The second number"
      }
    },
    required: ["operation", "a", "b"]
  }
};

// Tool execution function
function executeCalculator(params) {
  const { operation, a, b } = params;
  switch(operation) {
    case "add": return a + b;
    case "subtract": return a - b;
    case "multiply": return a * b;
    case "divide": return a / b;
    default: throw new Error("Unknown operation");
  }
}

async function testAnthropicToolCalling() {
  console.log('\n======= Testing Anthropic Tool Calling =======');
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⚠️ Skipping Anthropic test (ANTHROPIC_API_KEY not set)');
    return false;
  }
  
  try {
    console.log('Initializing Anthropic client...');
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    // Claude uses a tools array with input_schema instead of parameters
    const claudeTools = [calculatorToolClaude];
    
    console.log('Sending tool call request to Claude...');
    console.log('Tool format:', JSON.stringify(claudeTools, null, 2));
    
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: 'Calculate 24 multiplied by 15.' }
      ],
      tools: claudeTools,
    });
    
    console.log('Claude Tool Response Format:');
    console.log(JSON.stringify(response.content, null, 2));
    
    // Extract and execute tool calls
    let result = null;
    for (const content of response.content) {
      if (content.type === 'tool_use') {
        console.log(`\nClaude wants to use tool: ${content.name}`);
        console.log(`With parameters: ${JSON.stringify(content.input, null, 2)}`);
        
        if (content.name === 'calculator') {
          result = executeCalculator(content.input);
          console.log(`Tool result: ${result}`);
          
          // Send the tool result back to Claude
          const followUpResponse = await client.messages.create({
            model: 'claude-haiku-4-5',
            max_tokens: 1024,
            messages: [
              { role: 'user', content: 'Calculate 24 multiplied by 15.' },
              { 
                role: 'assistant', 
                content: [{ 
                  type: 'tool_use', 
                  name: content.name, 
                  input: content.input,
                  id: content.id
                }]
              },
              { 
                role: 'user', 
                content: [{ 
                  type: 'tool_result', 
                  tool_use_id: content.id, 
                  content: `${result}` 
                }]
              }
            ],
            tools: claudeTools,
          });
          
          console.log('\nClaude Response After Tool Result:');
          console.log(followUpResponse.content[0].text);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Anthropic tool calling test failed:', error);
    return false;
  }
}

async function testOpenAIToolCalling() {
  console.log('\n======= Testing OpenAI Tool Calling =======');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️ Skipping OpenAI test (OPENAI_API_KEY not set)');
    return false;
  }
  
  try {
    console.log('Initializing OpenAI client...');
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // OpenAI uses a tools array with functions
    const openAITools = [calculatorToolOpenAI];
    
    console.log('Sending tool call request to GPT-4...');
    console.log('Tool format:', JSON.stringify(openAITools, null, 2));
    
    const response = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'user', content: 'Calculate 24 multiplied by 15.' }
      ],
      tools: openAITools,
      tool_choice: "auto",
    });
    
    console.log('OpenAI Tool Response Format:');
    console.log(JSON.stringify(response.choices[0].message, null, 2));
    
    // Extract and execute tool calls
    const message = response.choices[0].message;
    let result = null;
    
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      console.log(`\nGPT-4 wants to use tool: ${toolCall.function.name}`);
      console.log(`With parameters: ${toolCall.function.arguments}`);
      
      if (toolCall.function.name === 'calculator') {
        const params = JSON.parse(toolCall.function.arguments);
        result = executeCalculator(params);
        console.log(`Tool result: ${result}`);
        
        // Send the tool result back to GPT-4
        const followUpResponse = await client.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [
            { role: 'user', content: 'Calculate 24 multiplied by 15.' },
            message,
            { 
              role: 'tool', 
              tool_call_id: toolCall.id, 
              content: `${result}`
            }
          ],
          tools: openAITools,
        });
        
        console.log('\nGPT-4 Response After Tool Result:');
        console.log(followUpResponse.choices[0].message.content);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ OpenAI tool calling test failed:', error);
    return false;
  }
}

async function testGeminiToolCalling() {
  console.log('\n======= Testing Google Gemini Tool Calling =======');
  
  if (!process.env.GEMINI_API_KEY) {
    console.log('⚠️ Skipping Gemini test (GEMINI_API_KEY not set)');
    return false;
  }
  
  try {
    console.log('Initializing Gemini client...');
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = client.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7
      },
      tools: [{
        functionDeclarations: [{
          name: "calculator",
          description: "A basic calculator that can perform arithmetic operations",
          parameters: {
            type: "object",
            properties: {
              operation: {
                type: "string",
                enum: ["add", "subtract", "multiply", "divide"],
                description: "The arithmetic operation to perform"
              },
              a: {
                type: "number",
                description: "The first number"
              },
              b: {
                type: "number",
                description: "The second number"
              }
            },
            required: ["operation", "a", "b"]
          }
        }]
      }]
    });
    
    console.log('Sending tool call request to Gemini...');
    console.log('Tool format: functionDeclarations array with JSONSchema parameters');
    
    const chat = model.startChat();
    const result = await chat.sendMessage('Calculate 24 multiplied by 15.');
    
    console.log('Gemini Tool Response Format:');
    const functionCalls = result.response.functionCalls();
    console.log(JSON.stringify(functionCalls, null, 2));
    
    // Extract and execute tool calls
    let calculationResult = null;
    
    if (functionCalls && functionCalls.length > 0) {
      const functionCall = functionCalls[0];
      console.log(`\nGemini wants to use function: ${functionCall.name}`);
      console.log(`With parameters: ${JSON.stringify(functionCall.args, null, 2)}`);
      
      if (functionCall.name === 'calculator') {
        calculationResult = executeCalculator(functionCall.args);
        console.log(`Tool result: ${calculationResult}`);
        
        // Due to issue with the function response format in the Node.js SDK,
        // we'll just print the result and skip the follow-up call
        console.log(`\nCalculation result: ${calculationResult}`);
      }
    } else {
      // If no function calls, just show the text response
      console.log('\nGemini text response (no function calls used):');
      console.log(result.response.text());
    }
    
    return true;
  } catch (error) {
    console.error('❌ Gemini tool calling test failed:', error);
    return false;
  }
}

async function runTests() {
  console.log('LLM Tool Calling Format Test');
  console.log('======================\n');
  
  const results = {
    anthropic: await testAnthropicToolCalling(),
    openai: await testOpenAIToolCalling(),
    gemini: await testGeminiToolCalling()
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