import { config } from '../../config'
import { ClaudeService } from './claude'
import { GeminiService } from './gemini'
import { OllamaService } from './ollama'
import { CharmonatorService } from './charmonator'

export type LLMProvider = 'claude' | 'gemini' | 'ollama' | 'charmonator'
export interface LLMConfig {
  provider: LLMProvider
  model?: string
  temperature?: number
}

export interface LLMService {
  chat(message: string): Promise<string>
}

export function createLLMService(currentConfig?: LLMConfig): LLMService {
  const provider = currentConfig?.provider || config.defaultLLMProvider;
  console.log(`Provider is ${provider} = current ${currentConfig?.provider} || ${config.defaultLLMProvider}`);
  switch (provider) {
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
    case 'charmonator':
      return new CharmonatorService(config.charmonatorBaseUrl)
    default:
      throw new Error(`Unknown LLM provider: ${provider}`)
  }
} 
