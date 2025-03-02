import "dotenv/config";

export interface Config {
  port: number
  anthropicApiKey?: string
  geminiApiKey?: string
  ollamaBaseUrl: string
  defaultLLMProvider: 'claude' | 'ollama' | 'charmonator' | 'gemini'
  charmonatorBaseUrl: string
}

export const config: Config = {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  defaultLLMProvider: (process.env.DEFAULT_LLM_PROVIDER as 'claude' | 'ollama' | 'charmonator' | 'gemini') || 'ollama',
  charmonatorBaseUrl: process.env.CHARMONATOR_BASE_URL || 'http://localhost:5002/charm/api/charmonator/v1'
} 
