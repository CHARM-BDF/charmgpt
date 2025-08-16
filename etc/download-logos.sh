#!/bin/bash

# Script to download logo files for LLM providers

echo "Creating public/logos directory if it doesn't exist..."
mkdir -p public/logos

# OpenAI logo
echo "Downloading OpenAI logo..."
curl -o public/logos/openai_logo.png "https://assets-global.website-files.com/6418b372316924035014a0c4/6418b7a0a4aca655e15b5552_openai-avatar.png"

# Google Gemini logo
echo "Downloading Google Gemini logo..."
curl -o public/logos/gemini_logo.png "https://seeklogo.com/images/G/google-gemini-logo-A05E5B4DD7-seeklogo.com.png"

echo "Done downloading logos!"
echo "Make sure the Claude and Ollama logos already exist in public/logos/" 