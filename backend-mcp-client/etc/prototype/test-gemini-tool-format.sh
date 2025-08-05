#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Testing Gemini Tool Format${NC}\n"

# Load environment variables from .env
if [ -f .env ]; then
    # More careful env loading that skips comments and handles spaces
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip comments and empty lines
        [[ $line =~ ^#.*$ ]] && continue
        [[ -z $line ]] && continue
        # Export the variable
        export "$line"
    done < .env
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Check if API key is available
if [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${RED}Error: GEMINI_API_KEY not found in .env${NC}"
    exit 1
fi

# Test different tool formats to see which one works
echo -e "${YELLOW}=== TEST 1: Format with functionDeclarations (standard Gemini format) ===${NC}\n"

# Sample tool definition (matching Gemini format)
TOOL_JSON_1='{
  "functionDeclarations": [
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

TOOL_JSON_2='{
  "functionDeclarations": [
    {
      "name": "test_formatter",
      "description": "A simple text formatter",
      "parameters": {
        "type": "object",
        "properties": {
          "text": {
            "type": "string",
            "description": "The text to format"
          },
          "format": {
            "type": "string",
            "enum": ["uppercase", "lowercase", "titlecase"],
            "description": "The format to apply"
          }
        },
        "required": ["text", "format"]
      }
    }
  ]
}'

# Gemini API request payload with multiple tools
API_PAYLOAD_1='{
  "model": "gemini-2.0-flash",
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Please add the numbers 5 and 7 using the calculator tool."
        }
      ]
    }
  ],
  "functionDeclarations": [
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
  ],
  "generationConfig": {
    "temperature": 0.2,
    "topK": 40,
    "topP": 0.95,
    "maxOutputTokens": 1024
  }
}'

echo -e "${GREEN}Tool Definition 1:${NC}"
echo "$TOOL_JSON_1" | jq '.'

echo -e "${GREEN}Tool Definition 2:${NC}"
echo "$TOOL_JSON_2" | jq '.'

echo -e "\n${GREEN}API Request Payload 1 (standard Gemini format):${NC}"
echo "$API_PAYLOAD_1" | jq '.'

# Make the API call for test format 1
echo -e "\n${BLUE}Making API Call to Gemini with Format 1...${NC}"
RESPONSE_1=$(curl -s -X POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY \
    -H "Content-Type: application/json" \
    -d "$API_PAYLOAD_1")

# Check if curl command succeeded for format 1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ API call successful${NC}"
    
    # Check if there's an error in the response
    if echo "$RESPONSE_1" | jq -e '.error' >/dev/null 2>&1; then
        echo -e "${RED}✗ API returned an error${NC}"
        echo -e "\n${RED}Error:${NC}"
        echo "$RESPONSE_1" | jq '.error'
    else
        echo -e "${GREEN}✓ No error in the response${NC}"
        
        # Check if response contains function calls
        if echo "$RESPONSE_1" | jq -e '.candidates[0].content.parts[0].functionCall' >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Response contains function calls${NC}"
            echo -e "\n${BLUE}Function Call Details:${NC}"
            echo "$RESPONSE_1" | jq '.candidates[0].content.parts[0].functionCall'
        else
            echo -e "${RED}✗ No function calls found in response${NC}"
            echo -e "\n${BLUE}Full Response:${NC}"
            echo "$RESPONSE_1" | jq '.'
        fi
    fi
else
    echo -e "${RED}✗ API call failed${NC}"
fi

# Test format 2: with parallel function calling
echo -e "\n\n${YELLOW}=== TEST 2: Format with parallel function calling ===${NC}\n"

# Gemini API request payload with parallel function calling
API_PAYLOAD_2='{
  "model": "gemini-2.0-flash",
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Please add 5 and 7, and also format the word 'hello' in uppercase."
        }
      ]
    }
  ],
  "functionDeclarations": [
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
    },
    {
      "name": "test_formatter",
      "description": "A simple text formatter",
      "parameters": {
        "type": "object",
        "properties": {
          "text": {
            "type": "string",
            "description": "The text to format"
          },
          "format": {
            "type": "string",
            "enum": ["uppercase", "lowercase", "titlecase"],
            "description": "The format to apply"
          }
        },
        "required": ["text", "format"]
      }
    }
  ],
  "generationConfig": {
    "temperature": 0.2,
    "topK": 40,
    "topP": 0.95,
    "maxOutputTokens": 1024
  }
}'

echo -e "${GREEN}API Request Payload 2 (parallel function calling):${NC}"
echo "$API_PAYLOAD_2" | jq '.'

# Make the API call for test format 2
echo -e "\n${BLUE}Making API Call to Gemini with Format 2...${NC}"
RESPONSE_2=$(curl -s -X POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY \
    -H "Content-Type: application/json" \
    -d "$API_PAYLOAD_2")

# Check if curl command succeeded for format 2
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ API call successful${NC}"
    
    # Check if there's an error in the response
    if echo "$RESPONSE_2" | jq -e '.error' >/dev/null 2>&1; then
        echo -e "${RED}✗ API returned an error${NC}"
        echo -e "\n${RED}Error:${NC}"
        echo "$RESPONSE_2" | jq '.error'
    else
        echo -e "${GREEN}✓ No error in the response${NC}"
        
        # Check if response contains function calls
        if echo "$RESPONSE_2" | jq -e '.candidates[0].content.parts[0].functionCall' >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Response contains function calls${NC}"
            echo -e "\n${BLUE}Function Call Details:${NC}"
            echo "$RESPONSE_2" | jq '.candidates[0].content.parts[0].functionCall'
        else
            echo -e "${RED}✗ No function calls found in response${NC}"
            echo -e "\n${BLUE}Full Response:${NC}"
            echo "$RESPONSE_2" | jq '.'
        fi
    fi
else
    echo -e "${RED}✗ API call failed${NC}"
fi

echo -e "\n${BLUE}Test Complete!${NC}" 