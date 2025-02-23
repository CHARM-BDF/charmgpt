import { config } from '../../config'
import { ClaudeService } from './claude'
import { GeminiService } from './gemini'
import { OllamaService } from './ollama'

export interface LLMService {
  chat(message: string): Promise<string>
}

export function createLLMService(): LLMService {
  switch (config.defaultLLMProvider) {
    case 'claude':
      if (!config.anthropicApiKey) {
        throw new Error('Anthropic API key is required for Claude')
      }
      return new ClaudeService(config.anthropicApiKey)
    case 'gemini':
      if (!config.geminiApiKey) {
        throw new Error('Gemini API key is required for Gemini')
      }
      return new GeminiService(config.geminiApiKey)
    case 'ollama':
      return new OllamaService(config.ollamaBaseUrl)
    default:
      throw new Error(`Unknown LLM provider: ${config.defaultLLMProvider}`)
  }
} 