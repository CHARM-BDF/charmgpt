import { LLMService } from './index'
import Anthropic from '@anthropic-ai/sdk'

export class ClaudeService implements LLMService {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey: apiKey
    })
  }

  async chat(message: string): Promise<string> {
    const response = await this.client.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024,
      messages: [{ role: 'user', content: message }]
    })

    const content = response.content[0]
    if ('text' in content) {
      return content.text
    }
    
    throw new Error('Unexpected response format from Claude')
  }
} 