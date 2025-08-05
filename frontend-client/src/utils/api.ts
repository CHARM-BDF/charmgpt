/**
 * Utility function to get API URLs, handling both proxy and override scenarios
 * @param endpoint - The API endpoint (without /api prefix)
 * @returns The full URL to use for the API call
 */
export const getApiUrl = (endpoint: string): string => {
  // Ensure endpoint starts with a slash
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  return import.meta.env.VITE_API_OVERRIDE
    ? `${import.meta.env.VITE_API_OVERRIDE}/api${normalizedEndpoint}`
    : `/api${normalizedEndpoint}`;
};

/**
 * Common API endpoints used in the application
 */
export const API_ENDPOINTS = {
  CHAT: '/chat',
  CHAT_BASIC: '/chat-basic',
  CHAT_TOOLS: '/chat-tools',
  CHAT_SEQUENTIAL: '/chat-sequential',
  CHAT_ARTIFACTS: '/chat-artifacts',
  OLLAMA: '/ollama',
  // Add new endpoints here as they are created
} as const; 