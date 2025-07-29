/**
 * LLM Service Utilities
 * 
 * This file contains utility functions for the LLM service.
 */

import { createHash } from 'crypto';

/**
 * Generate a deterministic cache key from a prompt and options
 * @param prompt The prompt text
 * @param options Additional request options that affect the response
 * @returns A hash of the request parameters
 */
export function generateCacheKey(prompt: string, options: Record<string, any> = {}): string {
  // Create a stable representation of the request
  const requestData = JSON.stringify({
    prompt,
    model: options.model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    systemPrompt: options.systemPrompt,
    responseFormat: options.responseFormat
  });
  
  // Generate hash for the request data
  return createHash('md5').update(requestData).digest('hex');
}

/**
 * Check if a value is a valid JSON string
 * @param value The string to check
 * @returns Whether the string is valid JSON
 */
export function isValidJSON(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Try to extract JSON from a text that might include markdown formatting
 * @param text Text that might contain JSON in code blocks
 * @returns The extracted JSON string or null if none found
 */
export function extractJSONFromText(text: string): string | null {
  // First try direct JSON extraction
  if (isValidJSON(text)) {
    return text;
  }
  
  // Try to find JSON in code blocks (markdown format)
  const jsonMatch = text.match(/```(?:json)?\s*({[\s\S]*?}|\[[\s\S]*?\])\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    const extracted = jsonMatch[1].trim();
    if (isValidJSON(extracted)) {
      return extracted;
    }
  }
  
  // Look for JSON outside of code blocks
  const jsonPattern = /({[\s\S]*?}|\[[\s\S]*?\])/g;
  let match;
  while ((match = jsonPattern.exec(text)) !== null) {
    const potentialJson = match[1].trim();
    if (isValidJSON(potentialJson)) {
      return potentialJson;
    }
  }
  
  return null;
} 