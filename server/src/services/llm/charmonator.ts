import { LLMService } from './index'

export class CharmonatorService implements LLMService {
  private baseUrl: string
  private model?: string
  private temperature?: number

  constructor(baseUrl: string, model?: string, temperature?: number) {
    this.baseUrl = baseUrl || 'http://localhost:5002'
    this.model = model || 'my-ollama-model'
    this.temperature = temperature || 0.7
  }

  async chat(message: string): Promise<string> {
    try {
        const request = {
            model: this.model,
            system: "You are a helpful AI assistant specializing in data science and programming.",
            temperature: this.temperature,
            transcript: {
                messages: [{ role: "user", content: message }]
            },
            options: {
                stream: false
            }
        }
      const response = await fetch(`${this.baseUrl}/chat/extend_transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        throw new Error(`Charmonator API error: ${response.statusText}`)
      }

      const data = await response.json()
      return data.messages[0].content;
    } catch (error) {
      console.error('Error in Charmonator chat:', error)
      throw error
    }
  }
}
