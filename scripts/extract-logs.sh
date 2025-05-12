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
grep "\[TOOL-CALLER-INPUT\]\|\[TOOL-CALLER-RESPONSE\]\|\[MCP-REQUEST\]\|\[MCP-RESPONSE\]\|\[FORMATTER-REQUEST\]\|\[FORMATTER-RESPONSE\]" "$LOG_FILE" > "$OUTPUT_FILE"

echo "Extraction complete. Results saved to: $OUTPUT_FILE" 