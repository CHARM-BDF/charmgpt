#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Testing Ollama Tool Format${NC}\n"

# Load environment variables from .env (safer method)
if [ -f .env ]; then
    # Only export valid variable assignments
    while IFS='=' read -r key value || [ -n "$key" ]; do
        # Skip comments and empty lines
        if [[ ! $key =~ ^#.*$ ]] && [[ -n $key ]]; then
            # Remove any leading/trailing whitespace
            key=$(echo $key | xargs)
            # Only export if key is valid
            if [[ $key =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
                export "$key=$value"
            fi
        fi
    done < .env
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Define Ollama API endpoint
OLLAMA_ENDPOINT="http://localhost:11434/api/chat"

# List available models
echo -e "${YELLOW}Available Ollama Models:${NC}"
curl -s http://localhost:11434/api/tags | jq '.models[].name'

# Define compatible models for testing - based on previous test results
echo -e "\n${YELLOW}Models that support tool calls:${NC}"
TOOL_MODELS=("llama3.2:latest" "mistral:latest")
printf "  %s\n" "${TOOL_MODELS[@]}"

echo -e "\n${YELLOW}Models that DO NOT support tool calls:${NC}"
echo -e "  deepscaler:latest"
echo -e "  deepseek-coder:latest"

# Test tool format with Ollama
echo -e "\n${YELLOW}=== TEST: Testing tool format with Ollama ===${NC}\n"

# Sample tool definition - adjust format based on Ollama's requirements
TOOL_JSON='{
  "name": "test_calculator",
  "description": "A simple calculator tool",
  "parameters": {
    "type": "object",
    "properties": {
      "operation": {
        "type": "string",
        "enum": ["add", "subtract", "multiply", "divide"],
        "description": "The mathematical operation to perform"
      },
      "numbers": {
        "type": "array",
        "items": {
          "type": "number"
        },
        "description": "Numbers to perform operation on"
      }
    },
    "required": ["operation", "numbers"]
  }
}'

# Test each model that supports tools
for MODEL in "${TOOL_MODELS[@]}"; do
    echo -e "\n${YELLOW}=== Testing with model: $MODEL ===${NC}\n"
    
    # Ollama API request payload with tool - based on successful format
    API_PAYLOAD='{
      "model": "'$MODEL'",
      "messages": [
        {
          "role": "user",
          "content": "Please add the numbers 5 and 7 using the calculator tool."
        }
      ],
      "stream": false,
      "tools": [
        {
          "name": "test_calculator",
          "description": "A simple calculator tool",
          "parameters": {
            "type": "object",
            "properties": {
              "operation": {
                "type": "string",
                "enum": ["add", "subtract", "multiply", "divide"],
                "description": "The mathematical operation to perform"
              },
              "numbers": {
                "type": "array",
                "items": {
                  "type": "number"
                },
                "description": "Numbers to perform operation on"
              }
            },
            "required": ["operation", "numbers"]
          }
        }
      ]
    }'
    
    echo -e "${GREEN}Tool Definition:${NC}"
    echo "$TOOL_JSON" | jq '.'
    
    echo -e "\n${GREEN}API Request Payload:${NC}"
    echo "$API_PAYLOAD" | jq '.'
    
    # Make the API call
    echo -e "\n${BLUE}Making API Call to Ollama with Model $MODEL...${NC}"
    RESPONSE=$(curl -s -X POST $OLLAMA_ENDPOINT \
        -H "Content-Type: application/json" \
        -d "$API_PAYLOAD")
    
    # Check if curl command succeeded
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ API call successful${NC}"
        
        # Check if there's an error in the response
        if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
            echo -e "${RED}✗ API returned an error${NC}"
            echo -e "\n${RED}Error:${NC}"
            echo "$RESPONSE" | jq '.error'
        else
            echo -e "${GREEN}✓ No error in the response${NC}"
            
            # Print the full response
            echo -e "\n${BLUE}Full Response:${NC}"
            echo "$RESPONSE" | jq '.'
            
            # Check if response contains tool calls
            if echo "$RESPONSE" | jq -e '.message.tool_calls' >/dev/null 2>&1; then
                echo -e "${GREEN}✓ Response contains tool calls${NC}"
                echo -e "\n${BLUE}Tool Call Details:${NC}"
                echo "$RESPONSE" | jq '.message.tool_calls'
                
                # Extract the specific arguments format
                echo -e "\n${YELLOW}Tool Call Arguments Format:${NC}"
                echo "$RESPONSE" | jq '.message.tool_calls[0].function.arguments'
                
                # Extract the tool call name format
                echo -e "\n${YELLOW}Tool Call Name Format:${NC}"
                echo "$RESPONSE" | jq '.message.tool_calls[0].function.name'
            else
                echo -e "${RED}✗ No tool calls found in response${NC}"
                echo -e "\n${YELLOW}Response Content:${NC}"
                echo "$RESPONSE" | jq '.message.content'
            fi
        fi
    else
        echo -e "${RED}✗ API call failed${NC}"
    fi
done

echo -e "\n${BLUE}Test Complete!${NC}"

# Summary of findings
echo -e "\n${YELLOW}=== SUMMARY OF FINDINGS ===${NC}"
echo -e "1. Tool support is available in llama3.2:latest and mistral:latest models"
echo -e "2. Tool format in Ollama differs from Claude - uses:\n   - tool_calls[].function.name (like 'calculator.add')\n   - tool_calls[].function.arguments (with 'a' and 'b' parameters)"
echo -e "3. No models supported the 'functions' format, only the 'tools' format"
echo -e "4. Tool calling implementation in Ollama appears to be experimental/limited"
echo -e "5. When implementing tool support for Ollama, adapters will need to handle the specific response format"

# Recommended format for Ollama
echo -e "\n${YELLOW}=== RECOMMENDED OLLAMA TOOL FORMAT ===${NC}"
echo -e "${GREEN}Request Format:${NC}"
echo '{
  "model": "llama3.2:latest",
  "messages": [
    {
      "role": "user",
      "content": "Your instruction here"
    }
  ],
  "stream": false,
  "tools": [
    {
      "name": "tool_name",
      "description": "Tool description",
      "parameters": {
        "type": "object",
        "properties": {
          "param1": {
            "type": "string",
            "description": "Parameter description"
          },
          "param2": {
            "type": "number",
            "description": "Parameter description"
          }
        },
        "required": ["param1", "param2"]
      }
    }
  ]
}' | jq '.'

echo -e "\n${GREEN}Response Format to Handle:${NC}"
echo '{
  "message": {
    "role": "assistant",
    "content": "",
    "tool_calls": [
      {
        "function": {
          "name": "tool_name.operation", 
          "arguments": {
            "a": "value1",
            "b": "value2"
          }
        }
      }
    ]
  }
}' | jq '.' 