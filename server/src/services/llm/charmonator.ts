import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { BaseMessage, AIMessage } from '@langchain/core/messages'

export class ChatCharmonator extends BaseChatModel {
  private baseUrl: string
  private modelName: string
  private temp: number

  constructor(baseUrl: string, model = 'my-charm-model', temperature = 0.7) {
    super({})
    this.baseUrl = baseUrl
    this.modelName = model
    this.temp = temperature
  }

  _llmType(): string {
    return 'charmonator'
  }

  async _generate(messages: BaseMessage[]): Promise<{ generations: { message: AIMessage; text: string }[] }> {
    const request = {
      model: this.modelName,
      system: "You are a helpful AI assistant specializing in data science and programming.",
      temperature: this.temp,
      transcript: {
        messages: messages.map(m => ({
          role: m._getType(),
          content: m.content
        }))
      },
      options: {
        stream: false
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/extend_transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        throw new Error(`Charmonator request failed: ${response.statusText}`)
      }

      const data = await response.json()
      return {
        generations: [{
          message: new AIMessage(data.messages[0].content),
          text: data.messages[0].content
        }]
      }
    } catch (error) {
      console.error('Error in Charmonator chat:', error)
      throw error
    }
  }
}
