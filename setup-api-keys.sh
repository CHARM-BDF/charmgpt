#!/bin/bash

# Setup API keys for Charm MCP
# Usage: ./setup-api-keys.sh

echo "====================================="
echo "Charm MCP API Keys Setup"
echo "====================================="
echo
echo "To use AI features, you need to set up API keys for LLM providers."
echo "You can get API keys from:"
echo "- Anthropic (Claude): https://console.anthropic.com/"
echo "- OpenAI: https://platform.openai.com/api-keys"
echo "- Google AI: https://aistudio.google.com/app/apikey"
echo
echo "You can also use Ollama for local AI (no API key needed)."
echo

# Check if API keys are already set
if [ ! -z "$ANTHROPIC_API_KEY" ] && [ "$ANTHROPIC_API_KEY" != "your_anthropic_api_key_here" ]; then
    echo "✅ ANTHROPIC_API_KEY is already set"
else
    echo "❌ ANTHROPIC_API_KEY not set"
fi

if [ ! -z "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "your_openai_api_key_here" ]; then
    echo "✅ OPENAI_API_KEY is already set"
else
    echo "❌ OPENAI_API_KEY not set"
fi

echo
echo "To set your API keys, run:"
echo "export ANTHROPIC_API_KEY='your_actual_api_key_here'"
echo "export OPENAI_API_KEY='your_actual_api_key_here'"
echo
echo "Or add them to your shell profile (~/.zshrc or ~/.bashrc):"
echo "echo 'export ANTHROPIC_API_KEY=\"your_key_here\"' >> ~/.zshrc"
echo "echo 'export OPENAI_API_KEY=\"your_key_here\"' >> ~/.zshrc"
echo
echo "Then restart your terminal or run: source ~/.zshrc"
echo
echo "====================================="
