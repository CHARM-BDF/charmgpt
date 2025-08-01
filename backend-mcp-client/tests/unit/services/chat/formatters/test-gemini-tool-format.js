import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY not found in .env');
  process.exit(1);
}

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Define the calculator tool
const calculatorTool = {
  name: 'test_calculator',
  description: 'A simple calculator tool',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'subtract', 'multiply', 'divide'],
        description: 'The mathematical operation to perform'
      },
      numbers: {
        type: 'array',
        items: { type: 'number' },
        description: 'Numbers to perform operation on'
      }
    },
    required: ['operation', 'numbers']
  }
};

// Define the response formatter tool
const responseFormatterTool = {
  name: 'response_formatter',
  description: 'Formats tool results into a user-friendly response',
  parameters: {
    type: 'object',
    properties: {
      toolResult: { type: 'object', description: 'The result from the tool call' }
    },
    required: ['toolResult']
  }
};

// Function to execute the calculator tool
function executeCalculatorTool(args) {
  const { operation, numbers } = args;
  let result;
  switch (operation) {
    case 'add':
      result = numbers.reduce((a, b) => a + b, 0);
      break;
    case 'subtract':
      result = numbers.reduce((a, b) => a - b);
      break;
    case 'multiply':
      result = numbers.reduce((a, b) => a * b, 1);
      break;
    case 'divide':
      result = numbers.reduce((a, b) => a / b);
      break;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
  return { result };
}

// Main function to test tool calling and formatting
async function testGeminiToolCalling() {
  try {
    // Define the user message
    const userMessage = 'Please add the numbers 5 and 7 using the calculator tool.';

    // Call the model with the calculator tool
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      tools: [{ functionDeclarations: [calculatorTool] }]
    });

    // Extract the function call from the response
    const response = result.response;
    const functionCall = response.candidates[0].content.parts[0].functionCall;

    if (functionCall) {
      console.log('Function Call:', functionCall);
      // Execute the function call
      const functionResult = executeCalculatorTool(functionCall.args);
      console.log('Function Result:', functionResult);

      // Formatting Step: Send the tool result back to Gemini with the response formatter tool
      const formatResult = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Format this result for the user.' }] }],
        tools: [{ functionDeclarations: [responseFormatterTool] }]
      });

      // Extract the formatted response
      const formattedResponse = formatResult.response;
      console.log('Formatted Response:', formattedResponse);
    } else {
      console.log('No function call found in the response.');
      console.log('Full Response:', response);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testGeminiToolCalling(); 