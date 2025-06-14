#!/bin/bash

# Check if log file path is provided
if [ -z "$1" ]; then
    echo "Usage: ./extract-logs.sh <log-file-path>"
    exit 1
fi

# Get the log file path
LOG_FILE="$1"

# Get the directory of the log file
LOG_DIR=$(dirname "$LOG_FILE")
LOG_NAME=$(basename "$LOG_FILE")
OUTPUT_FILE="${LOG_DIR}/${LOG_NAME%.log}-extracted.log"

echo "Extracting sections from $LOG_FILE..."
echo "Output will be saved to: $OUTPUT_FILE"

# Extract all matching lines directly to output file
grep "\[TOOL-CALLER-INPUT\]\|\[TOOL-CALLER-RESPONSE\]\|\[MCP-REQUEST\]\|\[MCP-RESPONSE\]\|\[FORMATTER-REQUEST\]\|\[FORMATTER-RESPONSE\]\|\[FORMATTER INPUT\]\|\[FORMATTER OUTPUT\]\|\[DEBUG-ANTHROPIC-FORMATTER\]\|\[STORE FORMAT\]\|\[ARTIFACT-COLLECTION\]\|\[LLM QUERY\]\|\[TOOL-CONVERSION-START\]\|\[TOOL-CONVERSION-INPUT\]\|\[TOOL-CONVERSION-OUTPUT\]\|\[GEMINI-TOOLS-DEBUG\]\|\[GEMINI-TOOLS-FINAL\]\|\[GEMINI-REQUEST-PAYLOAD\]\|\[GEMINI-RESPONSE\]\|\[GEMINI-ERROR\]\|\[CHAT-ARTIFACTS-ERROR\]\|=== GEMINI TOOL DEFINITION CONVERSION ===\|=== GEMINI TOOL CALL EXTRACTION ===\|=== GEMINI TOOL RESULT FORMATTING ===\|=== END GEMINI TOOL DEFINITION CONVERSION ===\|=== END GEMINI TOOL CALL EXTRACTION ===\|=== END GEMINI TOOL RESULT FORMATTING ===\|=== GEMINI LLM TOOL DEFINITION CONVERSION ===\|=== GEMINI LLM TOOL CALL EXTRACTION ===\|=== GEMINI LLM TOOL RESULT FORMATTING ===\|=== GEMINI LLM FUNCTION CALL CHECK ===\|=== END GEMINI LLM TOOL DEFINITION CONVERSION ===\|=== END GEMINI LLM TOOL CALL EXTRACTION ===\|=== END GEMINI LLM TOOL RESULT FORMATTING ===\|=== END GEMINI LLM FUNCTION CALL CHECK ===\|=== GEMINI FORMATTER TOOL DEFINITION ===\|=== GEMINI FORMATTER OUTPUT EXTRACTION ===\|=== GEMINI FORMATTER STORE CONVERSION ===\|=== END GEMINI FORMATTER TOOL DEFINITION ===\|=== END GEMINI FORMATTER OUTPUT EXTRACTION ===\|=== END GEMINI FORMATTER STORE CONVERSION ===" "$LOG_FILE" > "$OUTPUT_FILE"

echo "Extraction complete. Results saved to: $OUTPUT_FILE" 