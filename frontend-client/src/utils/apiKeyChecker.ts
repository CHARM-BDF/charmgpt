/**
 * Simple API Key Availability Checker
 * Fetches which models have API keys available from the server
 */

type ModelProvider = 'anthropic' | 'openai' | 'gemini' | 'ollama';

interface ApiKeyStatus {
  anthropic: boolean;
  openai: boolean;
  gemini: boolean;
  ollama: boolean;
}

/**
 * Fetch API key availability from server
 */
export async function fetchApiKeyStatus(): Promise<ApiKeyStatus> {
  try {
    const response = await fetch('/api/api-keys/status');
    const result = await response.json();
    
    if (result.success) {
      return result.data;
    } else {
      console.error('Failed to fetch API key status:', result.error);
      // Return default status (all false except ollama)
      return {
        anthropic: false,
        openai: false,
        gemini: false,
        ollama: true
      };
    }
  } catch (error) {
    console.error('Error fetching API key status:', error);
    // Return default status on error
    return {
      anthropic: false,
      openai: false,
      gemini: false,
      ollama: true
    };
  }
}

/**
 * Check if a specific provider has an API key
 */
export function hasApiKey(provider: ModelProvider, status: ApiKeyStatus): boolean {
  return status[provider];
} 