#!/bin/bash

echo "🧪 Testing Ollama Structured Outputs for Response Formatting"
echo "============================================================"

# Test the structured output format directly with Ollama
echo ""
echo "📋 Test 1: Direct Ollama Structured Output Test"
echo "------------------------------------------------"

curl -s -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:latest",
    "messages": [
      {
        "role": "user", 
        "content": "Explain what a variable is in programming. Format your response with thinking and conversation sections."
      }
    ],
    "stream": false,
    "format": {
      "type": "object",
      "properties": {
        "thinking": {
          "type": "string",
          "description": "Internal reasoning process"
        },
        "conversation": {
          "type": "array",
          "description": "Array of conversation segments",
          "items": {
            "type": "object",
            "properties": {
              "type": {
                "type": "string",
                "enum": ["text", "artifact"]
              },
              "content": {
                "type": "string"
              }
            },
            "required": ["type", "content"]
          }
        }
      },
      "required": ["conversation"]
    }
  }' | jq '.'

echo ""
echo "📋 Test 2: Testing with the Application"
echo "---------------------------------------"

# Test with the actual application
curl -s -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is a variable in programming?",
    "provider": "ollama",
    "model": "llama3.2:latest"
  }' | jq '.'

echo ""
echo "✅ Structured Output Tests Complete" 