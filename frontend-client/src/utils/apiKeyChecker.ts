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
 * Fetch API key availability from server with retry logic
 */
export async function fetchApiKeyStatus(retries: number = 3): Promise<ApiKeyStatus> {
  try {
    const response = await fetch('/api/api-keys/status');
    
    // Check if response is ok
    if (!response.ok) {
      console.error(`API key status request failed with status: ${response.status}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Check if response has content
    const text = await response.text();
    if (!text) {
      console.error('Empty response from API key status endpoint');
      throw new Error('Empty response');
    }
    
    const result = JSON.parse(text);
    
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
    
    // Retry if we have retries left and it's a network/server error
    if (retries > 0 && (error instanceof TypeError || error.message.includes('HTTP'))) {
      console.log(`Retrying API key status fetch, ${retries} attempts left...`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      return fetchApiKeyStatus(retries - 1);
    }
    
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