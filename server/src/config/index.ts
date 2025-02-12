export interface Config {
  port: number
  anthropicApiKey?: string
  ollamaBaseUrl: string
  defaultLLMProvider: 'claude' | 'ollama' | 'charmonator'
  charmonatorBaseUrl: string
}

export const config: Config = {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  defaultLLMProvider: (process.env.DEFAULT_LLM_PROVIDER as 'claude' | 'ollama' | 'charmonator') || 'ollama',
  charmonatorBaseUrl: process.env.CHARMONATOR_BASE_URL || 'http://localhost:5002/charm/api/charmonator/v1'
} 