#!/bin/bash

# Enhanced Ollama Tool Testing Script
# Focuses on debugging the response_formatter tool issue

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Enhanced Ollama Response Formatter Testing ===${NC}\n"

# Define Ollama API endpoint
OLLAMA_ENDPOINT="http://localhost:11434/api/chat"

# Check if Ollama is running
echo -e "${YELLOW}Checking Ollama availability...${NC}"
if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo -e "${RED}✗ Ollama is not running or not accessible${NC}"
    echo -e "Please start Ollama and try again"
    exit 1
fi

echo -e "${GREEN}✓ Ollama is running${NC}\n"

# List available models
echo -e "${YELLOW}Available Ollama Models:${NC}"
curl -s http://localhost:11434/api/tags | jq -r '.models[].name' | head -10

echo -e "\n${PURPLE}=== TEST SERIES: Understanding Tool Call Behavior ===${NC}\n"

# Test 1: Simple tool (should work based on our previous tests)
echo -e "${YELLOW}TEST 1: Simple Calculator Tool (Known to work)${NC}"

SIMPLE_TOOL_PAYLOAD='{
  "model": "llama3.2:latest",
  "messages": [
    {
      "role": "user",
      "content": "Add 5 and 7 using the calculator"
    }
  ],
  "stream": false,
  "tools": [
    {
      "name": "calculator",
      "description": "Simple calculator",
      "parameters": {
        "type": "object",
        "properties": {
          "operation": {
            "type": "string",
            "enum": ["add", "subtract"]
          },
          "a": {"type": "number"},
          "b": {"type": "number"}
        },
        "required": ["operation", "a", "b"]
      }
    }
  ]
}'

echo -e "${BLUE}Request:${NC}"
echo "$SIMPLE_TOOL_PAYLOAD" | jq '.'

echo -e "\n${BLUE}Making API call...${NC}"
RESPONSE1=$(curl -s -X POST $OLLAMA_ENDPOINT \
    -H "Content-Type: application/json" \
    -d "$SIMPLE_TOOL_PAYLOAD")

echo -e "\n${GREEN}Response Analysis:${NC}"
echo "$RESPONSE1" | jq '{
  has_tool_calls: (.message.tool_calls != null),
  tool_calls_count: (.message.tool_calls | length // 0),
  has_content: (.message.content != null and .message.content != ""),
  content_preview: (.message.content[:100] // "")
}'

if echo "$RESPONSE1" | jq -e '.message.tool_calls' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Simple tool WORKS - got tool calls${NC}"
    echo "$RESPONSE1" | jq '.message.tool_calls'
else
    echo -e "${RED}✗ Simple tool FAILED - no tool calls${NC}"
    echo "$RESPONSE1" | jq '.message.content'
fi

echo -e "\n${PURPLE}================================================${NC}\n"

# Test 2: Medium complexity tool 
echo -e "${YELLOW}TEST 2: Medium Complexity Tool${NC}"

MEDIUM_TOOL_PAYLOAD='{
  "model": "llama3.2:latest",
  "messages": [
    {
      "role": "user",
      "content": "Format a simple response"
    }
  ],
  "stream": false,
  "tools": [
    {
      "name": "simple_formatter",
      "description": "Format a simple response",
      "parameters": {
        "type": "object",
        "properties": {
          "text": {
            "type": "string",
            "description": "The formatted text"
          },
          "type": {
            "type": "string",
            "enum": ["info", "error", "success"]
          }
        },
        "required": ["text", "type"]
      }
    }
  ]
}'

echo -e "${BLUE}Request:${NC}"
echo "$MEDIUM_TOOL_PAYLOAD" | jq '.'

echo -e "\n${BLUE}Making API call...${NC}"
RESPONSE2=$(curl -s -X POST $OLLAMA_ENDPOINT \
    -H "Content-Type: application/json" \
    -d "$MEDIUM_TOOL_PAYLOAD")

echo -e "\n${GREEN}Response Analysis:${NC}"
echo "$RESPONSE2" | jq '{
  has_tool_calls: (.message.tool_calls != null),
  tool_calls_count: (.message.tool_calls | length // 0),
  has_content: (.message.content != null and .message.content != ""),
  content_preview: (.message.content[:100] // "")
}'

if echo "$RESPONSE2" | jq -e '.message.tool_calls' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Medium tool WORKS - got tool calls${NC}"
    echo "$RESPONSE2" | jq '.message.tool_calls'
else
    echo -e "${RED}✗ Medium tool FAILED - no tool calls${NC}"
    echo "$RESPONSE2" | jq '.message.content'
fi

echo -e "\n${PURPLE}================================================${NC}\n"

# Test 3: Simplified Response Formatter (reduce complexity)
echo -e "${YELLOW}TEST 3: Simplified Response Formatter${NC}"

SIMPLE_FORMATTER_PAYLOAD='{
  "model": "llama3.2:latest",
  "messages": [
    {
      "role": "user",
      "content": "Format this response: Hello world"
    }
  ],
  "stream": false,
  "tools": [
    {
      "name": "response_formatter",
      "description": "Format responses in a simple JSON structure",
      "parameters": {
        "type": "object",
        "properties": {
          "conversation": {
            "type": "array",
            "description": "Array of conversation items",
            "items": {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "enum": ["text"]
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
    }
  ]
}'

echo -e "${BLUE}Request:${NC}"
echo "$SIMPLE_FORMATTER_PAYLOAD" | jq '.'

echo -e "\n${BLUE}Making API call...${NC}"
RESPONSE3=$(curl -s -X POST $OLLAMA_ENDPOINT \
    -H "Content-Type: application/json" \
    -d "$SIMPLE_FORMATTER_PAYLOAD")

echo -e "\n${GREEN}Response Analysis:${NC}"
echo "$RESPONSE3" | jq '{
  has_tool_calls: (.message.tool_calls != null),
  tool_calls_count: (.message.tool_calls | length // 0),
  has_content: (.message.content != null and .message.content != ""),
  content_preview: (.message.content[:100] // "")
}'

if echo "$RESPONSE3" | jq -e '.message.tool_calls' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Simplified formatter WORKS - got tool calls${NC}"
    echo "$RESPONSE3" | jq '.message.tool_calls'
else
    echo -e "${RED}✗ Simplified formatter FAILED - no tool calls${NC}"
    echo "$RESPONSE3" | jq '.message.content'
fi

echo -e "\n${PURPLE}================================================${NC}\n"

# Test 4: Full Complex Response Formatter (like in the app)
echo -e "${YELLOW}TEST 4: Full Complex Response Formatter (App Version)${NC}"

COMPLEX_FORMATTER_PAYLOAD='{
  "model": "llama3.2:latest",
  "messages": [
    {
      "role": "user",
      "content": "Create a sine wave graph with Python"
    }
  ],
  "stream": false,
  "tools": [
    {
      "name": "response_formatter",
      "description": "Format all responses in a consistent JSON structure with direct array values, not string-encoded JSON",
      "parameters": {
        "type": "object",
        "properties": {
          "thinking": {
            "type": "string",
            "description": "Optional internal reasoning process, formatted in markdown"
          },
          "conversation": {
            "type": "array",
            "description": "Array of conversation segments and artifacts in order of appearance. Return as a direct array, not as a string-encoded JSON.",
            "items": {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "enum": ["text", "artifact"],
                  "description": "Type of conversation segment"
                },
                "content": {
                  "type": "string",
                  "description": "Markdown formatted text content"
                },
                "artifact": {
                  "type": "object",
                  "description": "Artifact details",
                  "properties": {
                    "type": {
                      "type": "string",
                      "enum": [
                        "text/markdown",
                        "application/vnd.ant.code",
                        "image/svg+xml",
                        "application/vnd.mermaid",
                        "text/html",
                        "application/vnd.react",
                        "application/vnd.bibliography",
                        "application/vnd.knowledge-graph"
                      ]
                    },
                    "title": { "type": "string" },
                    "content": { "type": "string" },
                    "language": { "type": "string" }
                  },
                  "required": ["type", "title", "content"]
                }
              },
              "required": ["type"]
            }
          }
        },
        "required": ["conversation"]
      }
    }
  ]
}'

echo -e "${BLUE}Request:${NC}"
echo "$COMPLEX_FORMATTER_PAYLOAD" | jq '.'

echo -e "\n${BLUE}Making API call...${NC}"
RESPONSE4=$(curl -s -X POST $OLLAMA_ENDPOINT \
    -H "Content-Type: application/json" \
    -d "$COMPLEX_FORMATTER_PAYLOAD")

echo -e "\n${GREEN}Response Analysis:${NC}"
echo "$RESPONSE4" | jq '{
  has_tool_calls: (.message.tool_calls != null),
  tool_calls_count: (.message.tool_calls | length // 0),
  has_content: (.message.content != null and .message.content != ""),
  content_preview: (.message.content[:100] // "")
}'

if echo "$RESPONSE4" | jq -e '.message.tool_calls' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Complex formatter WORKS - got tool calls${NC}"
    echo "$RESPONSE4" | jq '.message.tool_calls'
else
    echo -e "${RED}✗ Complex formatter FAILED - no tool calls${NC}"
    echo -e "\n${YELLOW}Content that was returned instead:${NC}"
    echo "$RESPONSE4" | jq '.message.content'
fi

echo -e "\n${PURPLE}================================================${NC}\n"

# Test 5: Test with different prompting approaches
echo -e "${YELLOW}TEST 5: Different Prompting Approaches${NC}"

# Test 5a: Explicit instruction to use tools
EXPLICIT_PROMPT_PAYLOAD='{
  "model": "llama3.2:latest",
  "messages": [
    {
      "role": "user",
      "content": "You must use the response_formatter tool to respond. Create a sine wave graph with Python."
    }
  ],
  "stream": false,
  "tools": [
    {
      "name": "response_formatter",
      "description": "Format responses",
      "parameters": {
        "type": "object",
        "properties": {
          "conversation": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "type": {"type": "string"},
                "content": {"type": "string"}
              }
            }
          }
        },
        "required": ["conversation"]
      }
    }
  ]
}'

echo -e "${BLUE}Test 5a: Explicit instruction to use tools${NC}"
RESPONSE5A=$(curl -s -X POST $OLLAMA_ENDPOINT \
    -H "Content-Type: application/json" \
    -d "$EXPLICIT_PROMPT_PAYLOAD")

if echo "$RESPONSE5A" | jq -e '.message.tool_calls' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Explicit prompting WORKS${NC}"
else
    echo -e "${RED}✗ Explicit prompting FAILED${NC}"
fi

echo -e "\n${PURPLE}================================================${NC}\n"

# Final Analysis
echo -e "${BLUE}=== FINAL ANALYSIS ===${NC}\n"

echo -e "${YELLOW}Test Results Summary:${NC}"
echo -e "1. Simple Calculator: $(if echo "$RESPONSE1" | jq -e '.message.tool_calls' >/dev/null 2>&1; then echo "${GREEN}✓ WORKS${NC}"; else echo "${RED}✗ FAILS${NC}"; fi)"
echo -e "2. Medium Complexity: $(if echo "$RESPONSE2" | jq -e '.message.tool_calls' >/dev/null 2>&1; then echo "${GREEN}✓ WORKS${NC}"; else echo "${RED}✗ FAILS${NC}"; fi)"
echo -e "3. Simplified Formatter: $(if echo "$RESPONSE3" | jq -e '.message.tool_calls' >/dev/null 2>&1; then echo "${GREEN}✓ WORKS${NC}"; else echo "${RED}✗ FAILS${NC}"; fi)"
echo -e "4. Complex Formatter: $(if echo "$RESPONSE4" | jq -e '.message.tool_calls' >/dev/null 2>&1; then echo "${GREEN}✓ WORKS${NC}"; else echo "${RED}✗ FAILS${NC}"; fi)"
echo -e "5. Explicit Prompting: $(if echo "$RESPONSE5A" | jq -e '.message.tool_calls' >/dev/null 2>&1; then echo "${GREEN}✓ WORKS${NC}"; else echo "${RED}✗ FAILS${NC}"; fi)"

echo -e "\n${YELLOW}Key Findings:${NC}"
echo -e "• Tool complexity appears to affect whether Ollama uses tool calls vs text"
echo -e "• Simple tools are more likely to trigger actual tool calling"
echo -e "• Complex schemas may cause Ollama to fall back to text responses"
echo -e "• The response_formatter tool may be too complex for reliable tool calling"

echo -e "\n${YELLOW}Recommendations:${NC}"
echo -e "• Simplify the response_formatter tool schema"
echo -e "• Use multiple simpler tools instead of one complex tool"
echo -e "• Consider prompting strategies to encourage tool usage"
echo -e "• Implement fallback parsing for text-based tool responses"

echo -e "\n${BLUE}Test Complete!${NC}" 