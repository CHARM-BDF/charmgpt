import { ChatAnthropic } from '@langchain/anthropic'
import { ChatOllama } from '@langchain/community/chat_models/ollama'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { config } from '../config'
import { ChatCharmonator } from './llm/charmonator'

export type LLMProvider = 'claude' | 'ollama' | 'charmonator'

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

  private initializeLLM(initConfig?: LLMConfig): BaseChatModel {
    const provider = initConfig?.provider || config.defaultLLMProvider;
    switch (provider) {
      case 'claude':
        return new ChatAnthropic({
          anthropicApiKey: config.anthropicApiKey,
          modelName: initConfig?.model || 'claude-3-sonnet-20240229',
          temperature: initConfig?.temperature || 0.7,
        })
      
      case 'ollama':
        return new ChatOllama({
          baseUrl: config.ollamaBaseUrl,
          model: initConfig?.model || 'qwen2.5',
          temperature: initConfig?.temperature || 0.7,
        })

      case 'charmonator':
        return new ChatCharmonator(
          config.charmonatorBaseUrl,
          initConfig?.model,
          initConfig?.temperature
        )

      default:
        throw new Error(`Unsupported LLM provider: ${provider}`)
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
    console.log(codePrompt);
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