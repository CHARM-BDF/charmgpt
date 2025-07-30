#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Testing Claude Tool Format${NC}\n"

# Load environment variables from .env
if [ -f .env ]; then
    # More careful env loading that skips comments and handles spaces
    export $(grep -v '^#' .env | xargs -0)
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Check if API key is available
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}Error: ANTHROPIC_API_KEY not found in .env${NC}"
    exit 1
fi

# Test different tool formats to see which one works
echo -e "${YELLOW}=== TEST 1: Format with input_schema directly on the tool (from chat.ts) ===${NC}\n"

# Sample tool definition (matching chat.ts format)
TOOL_JSON_1='{
  "name": "test_calculator",
  "description": "A simple calculator tool",
  "input_schema": {
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

TOOL_JSON_2='{
  "name": "test_formatter",
  "description": "A simple text formatter",
  "input_schema": {
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
}'

# Claude API request payload with multiple tools (input_schema directly)
API_PAYLOAD_1='{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 4000,
  "messages": [
    {
      "role": "user",
      "content": "Please add the numbers 5 and 7 using the calculator tool."
    }
  ],
  "tools": [
    {
      "name": "test_calculator",
      "description": "A simple calculator tool",
      "input_schema": {
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
      "input_schema": {
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
  "tool_choice": { "type": "tool", "name": "test_calculator" }
}'

echo -e "${GREEN}Tool Definition 1:${NC}"
echo "$TOOL_JSON_1" | jq '.'

echo -e "${GREEN}Tool Definition 2:${NC}"
echo "$TOOL_JSON_2" | jq '.'

echo -e "\n${GREEN}API Request Payload 1 (input_schema directly):${NC}"
echo "$API_PAYLOAD_1" | jq '.'

# Make the API call for test format 1
echo -e "\n${BLUE}Making API Call to Claude with Format 1...${NC}"
RESPONSE_1=$(curl -s -X POST https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
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
        
        # Check if response contains tool calls
        if echo "$RESPONSE_1" | jq -e '.content[].type == "tool_use"' >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Response contains tool calls${NC}"
            echo -e "\n${BLUE}Tool Call Details:${NC}"
            echo "$RESPONSE_1" | jq '.content[] | select(.type == "tool_use")'
        else
            echo -e "${RED}✗ No tool calls found in response${NC}"
        fi
    fi
else
    echo -e "${RED}✗ API call failed${NC}"
fi

# Test format 2: with custom wrapper (as in logs)
echo -e "\n\n${YELLOW}=== TEST 2: Format with input_schema under custom (from logs) ===${NC}\n"

# Claude API request payload with custom wrapper
API_PAYLOAD_2='{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 4000,
  "messages": [
    {
      "role": "user",
      "content": "Please add the numbers 5 and 7 using the calculator tool."
    }
  ],
  "tools": [
    {
      "name": "test_calculator",
      "description": "A simple calculator tool",
      "custom": {
        "input_schema": {
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
    },
    {
      "name": "test_formatter",
      "description": "A simple text formatter",
      "custom": {
        "input_schema": {
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
    }
  ],
  "tool_choice": { "type": "tool", "name": "test_calculator" }
}'

echo -e "${GREEN}API Request Payload 2 (with custom wrapper):${NC}"
echo "$API_PAYLOAD_2" | jq '.'

# Make the API call for test format 2
echo -e "\n${BLUE}Making API Call to Claude with Format 2...${NC}"
RESPONSE_2=$(curl -s -X POST https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
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
        
        # Check if response contains tool calls
        if echo "$RESPONSE_2" | jq -e '.content[].type == "tool_use"' >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Response contains tool calls${NC}"
            echo -e "\n${BLUE}Tool Call Details:${NC}"
            echo "$RESPONSE_2" | jq '.content[] | select(.type == "tool_use")'
        else
            echo -e "${RED}✗ No tool calls found in response${NC}"
        fi
    fi
else
    echo -e "${RED}✗ API call failed${NC}"
fi

echo -e "\n${BLUE}Test Complete!${NC}" 