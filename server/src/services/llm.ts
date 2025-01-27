import { ChatAnthropic } from '@langchain/anthropic'
import { ChatOllama } from '@langchain/community/chat_models/ollama'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'

export type LLMProvider = 'claude' | 'ollama'

export interface LLMConfig {
  provider: LLMProvider
  model?: string
  temperature?: number
}

export class LLMService {
  private llm: BaseChatModel
  private systemPrompt: string

  constructor(config: LLMConfig) {
    this.llm = this.initializeLLM(config)
    this.systemPrompt = "You are a helpful AI assistant specializing in data science and programming."
  }

  private initializeLLM(config: LLMConfig): BaseChatModel {
    switch (config.provider) {
      case 'claude':
        return new ChatAnthropic({
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
          modelName: config.model || 'claude-3-sonnet-20240229',
          temperature: config.temperature || 0.7,
        })
      
      case 'ollama':
        return new ChatOllama({
          baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
          model: config.model || 'mistral',
          temperature: config.temperature || 0.7,
        })

      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`)
    }
  }

  async chat(message: string): Promise<string> {
    try {
      const response = await this.llm.invoke([
        new SystemMessage(this.systemPrompt),
        new HumanMessage(message)
      ])
      
      return response.content as string
    } catch (error) {
      console.error('Error in LLM chat:', error)
      throw error
    }
  }

  async generateCode(prompt: string): Promise<string> {
    const codePrompt = `Generate Python code for the following request. Only return the code without any explanation:\n${prompt}`
    
    try {
      const response = await this.llm.invoke([
        new SystemMessage(this.systemPrompt),
        new HumanMessage(codePrompt)
      ])
      
      return response.content as string
    } catch (error) {
      console.error('Error in code generation:', error)
      throw error
    }
  }
} 