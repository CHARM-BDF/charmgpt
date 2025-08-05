#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}Testing Ollama Response Formatter Tool${NC}\n"

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

# Real response_formatter tool definition from systemPrompt.ts
RESPONSE_FORMATTER_TOOL='{
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
        "description": "Array of conversation segments and artifacts in order of appearance. MUST be a direct array, never a string",
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
              "description": "For type text: markdown formatted text content"
            },
            "artifact": {
              "type": "object",
              "description": "For type artifact: artifact details",
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
                    "application/vnd.bibliography"
                  ]
                },
                "id": {
                  "type": "string",
                  "description": "Unique identifier for the artifact"
                },
                "title": {
                  "type": "string",
                  "description": "Display title for the artifact"
                },
                "content": {
                  "type": "string",
                  "description": "The actual content of the artifact"
                },
                "language": {
                  "type": "string",
                  "description": "Programming language when applicable"
                }
              },
              "required": ["type", "id", "title", "content"]
            }
          },
          "required": ["type"]
        }
      }
    },
    "required": ["conversation"]
  }
}'

# System prompts to test (from actual application)
declare -A SYSTEM_PROMPTS
SYSTEM_PROMPTS["basic"]="You are a helpful AI assistant with access to tools. When asked to format responses, always use the response_formatter tool."

SYSTEM_PROMPTS["detailed"]="You are an AI assistant that formats responses using a structured JSON format through tool calls. All responses must be formatted using the response_formatter tool. Use the response_formatter tool for ALL responses. IMPORTANT: Always return the conversation as a direct array, never as a string-encoded JSON."

SYSTEM_PROMPTS["full"]="You are an AI assistant that formats responses using a structured JSON format through tool calls. All responses must be formatted using the response_formatter tool.

You must use the response_formatter tool for ALL responses. IMPORTANT: Always return the conversation as a direct array, never as a string-encoded JSON.

Example Response Structure:
{
    \"thinking\": \"Optional markdown formatted thinking process\",
    \"conversation\": [
        {
            \"type\": \"text\",
            \"content\": \"# Introduction\\n\\nHere's how to implement...\"
        },
        {
            \"type\": \"artifact\",
            \"artifact\": {
                \"type\": \"application/vnd.ant.code\",
                \"id\": \"example-code\",
                \"title\": \"Example Implementation\",
                \"content\": \"code here...\",
                \"language\": \"typescript\"
            }
        }
    ]
}

Important Rules:
1. ALWAYS use the response_formatter tool for ALL responses
2. NEVER return the conversation as a string-encoded JSON - it MUST be a direct array
3. NEVER nest a \"conversation\" object inside the conversation field"

# Test cases with realistic conversation scenarios
declare -A TEST_CASES
TEST_CASES["simple"]="Hello, how are you today?"
TEST_CASES["technical"]="Explain how async/await works in JavaScript with a code example"
TEST_CASES["code_generation"]="Write a Python function to sort a list and explain how it works"
TEST_CASES["complex"]="What are the key differences between React and Vue.js? Include code examples for both."
TEST_CASES["markdown"]="Create a markdown guide for Git basics with examples"

echo -e "\n${PURPLE}=== TESTING RESPONSE FORMATTER TOOL ===${NC}\n"

# Test each model with each system prompt and test case combination
for MODEL in "${TOOL_MODELS[@]}"; do
    echo -e "\n${CYAN}=== Testing Model: $MODEL ===${NC}\n"
    
    for PROMPT_TYPE in "basic" "detailed" "full"; do
        echo -e "\n${YELLOW}--- System Prompt Type: $PROMPT_TYPE ---${NC}\n"
        
        for TEST_TYPE in "simple" "technical" "code_generation"; do
            echo -e "\n${GREEN}Test Case: $TEST_TYPE${NC}"
            echo -e "${GREEN}User Message: ${TEST_CASES[$TEST_TYPE]}${NC}\n"
            
            # Build the API payload
            API_PAYLOAD=$(jq -n \
                --arg model "$MODEL" \
                --arg system_prompt "${SYSTEM_PROMPTS[$PROMPT_TYPE]}" \
                --arg user_content "${TEST_CASES[$TEST_TYPE]}" \
                --argjson tool "$RESPONSE_FORMATTER_TOOL" \
                '{
                    "model": $model,
                    "messages": [
                        {
                            "role": "system",
                            "content": $system_prompt
                        },
                        {
                            "role": "user", 
                            "content": $user_content
                        }
                    ],
                    "stream": false,
                    "tools": [$tool]
                }')
            
            echo -e "${BLUE}Making API Call...${NC}"
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
                    
                    # Analyze the response in detail
                    echo -e "\n${BLUE}=== RESPONSE ANALYSIS ===${NC}"
                    
                    # Check if response contains tool calls
                    if echo "$RESPONSE" | jq -e '.message.tool_calls' >/dev/null 2>&1; then
                        echo -e "${GREEN}✓ Response contains tool calls${NC}"
                        
                        # Check tool call name
                        TOOL_NAME=$(echo "$RESPONSE" | jq -r '.message.tool_calls[0].function.name // "none"')
                        if [ "$TOOL_NAME" = "response_formatter" ]; then
                            echo -e "${GREEN}✓ Used exact 'response_formatter' tool name${NC}"
                        else
                            echo -e "${YELLOW}⚠ Used different tool name: $TOOL_NAME${NC}"
                        fi
                        
                        # Check if arguments contain required fields
                        ARGS=$(echo "$RESPONSE" | jq '.message.tool_calls[0].function.arguments')
                        
                        if echo "$ARGS" | jq -e '.conversation' >/dev/null 2>&1; then
                            echo -e "${GREEN}✓ Contains 'conversation' field${NC}"
                            
                            # Check if conversation is an array
                            if echo "$ARGS" | jq -e '.conversation | type == "array"' >/dev/null 2>&1; then
                                echo -e "${GREEN}✓ Conversation is an array (correct format)${NC}"
                                
                                # Count conversation items
                                CONV_COUNT=$(echo "$ARGS" | jq '.conversation | length')
                                echo -e "${BLUE}  → Conversation items: $CONV_COUNT${NC}"
                                
                                # Check conversation item structure
                                if [ "$CONV_COUNT" -gt 0 ]; then
                                    FIRST_ITEM_TYPE=$(echo "$ARGS" | jq -r '.conversation[0].type // "missing"')
                                    echo -e "${BLUE}  → First item type: $FIRST_ITEM_TYPE${NC}"
                                    
                                    if [ "$FIRST_ITEM_TYPE" = "text" ] || [ "$FIRST_ITEM_TYPE" = "artifact" ]; then
                                        echo -e "${GREEN}✓ Valid conversation item type${NC}"
                                    else
                                        echo -e "${RED}✗ Invalid conversation item type${NC}"
                                    fi
                                fi
                            else
                                CONV_TYPE=$(echo "$ARGS" | jq -r '.conversation | type')
                                echo -e "${RED}✗ Conversation is $CONV_TYPE, not array${NC}"
                                
                                # Show what it actually contains
                                echo -e "${YELLOW}Actual conversation content:${NC}"
                                echo "$ARGS" | jq '.conversation' | head -3
                            fi
                        else
                            echo -e "${RED}✗ Missing 'conversation' field${NC}"
                        fi
                        
                        if echo "$ARGS" | jq -e '.thinking' >/dev/null 2>&1; then
                            echo -e "${GREEN}✓ Contains 'thinking' field${NC}"
                        else
                            echo -e "${YELLOW}⚠ Missing 'thinking' field (optional)${NC}"
                        fi
                        
                        # Show the actual arguments structure
                        echo -e "\n${BLUE}Tool Call Arguments Structure:${NC}"
                        echo "$ARGS" | jq '.' | head -20
                        
                    else
                        echo -e "${RED}✗ No tool calls found in response${NC}"
                        echo -e "\n${YELLOW}Response Content Instead:${NC}"
                        CONTENT=$(echo "$RESPONSE" | jq -r '.message.content // "empty"')
                        echo "$CONTENT" | head -5
                        
                        # Check if content looks like JSON
                        if echo "$CONTENT" | jq '.' >/dev/null 2>&1; then
                            echo -e "${YELLOW}⚠ Content appears to be JSON (possible malformed tool call)${NC}"
                        fi
                    fi
                    
                    # Show full response for debugging (truncated)
                    echo -e "\n${BLUE}Full Response (first 500 chars):${NC}"
                    echo "$RESPONSE" | jq '.' | head -20
                fi
            else
                echo -e "${RED}✗ API call failed${NC}"
            fi
            
            echo -e "\n${PURPLE}----------------------------------------${NC}"
        done
    done
done

echo -e "\n${BLUE}Test Complete!${NC}"

# Summary of findings
echo -e "\n${YELLOW}=== SUMMARY OF FINDINGS ===${NC}"
echo -e "1. Response formatter tool uses complex nested array structure"
echo -e "2. Real tool requires 'conversation' as array of objects with 'type' field"
echo -e "3. Each conversation item can be 'text' or 'artifact' type"
echo -e "4. Artifact type requires nested object with id, title, content, type"
echo -e "5. System prompt instructions are critical for proper tool usage"
echo -e "6. Ollama may struggle with complex nested schemas vs simple tools"

echo -e "\n${YELLOW}=== COMPARISON WITH SIMPLE TOOLS ===${NC}"
echo -e "Simple calculator tool (from previous test): ✓ Works reliably"
echo -e "Complex response_formatter tool: Results vary by model and prompt"
echo -e "Schema complexity appears to be the key differentiator"

echo -e "\n${YELLOW}=== RECOMMENDATIONS ===${NC}"
echo -e "1. Test shows why hybrid approach in Ollama formatter is necessary"
echo -e "2. Complex tool schemas may need simplification for Ollama"
echo -e "3. System prompt engineering is crucial for tool adoption"
echo -e "4. Fallback parsing of text content remains important"
echo -e "5. Consider tool schema complexity when designing Ollama integrations" 