import { LLMService } from './index'

export class CharmonatorService implements LLMService {
  private baseUrl: string
  private model?: string
  private temperature?: number

  constructor(baseUrl: string, model?: string, temperature?: number) {
    this.baseUrl = baseUrl || 'http://localhost:8000'
    this.model = model
    this.temperature = temperature || 0.7
  }

  async chat(message: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          model: this.model,
          temperature: this.temperature,
        }),
      })

      if (!response.ok) {
        throw new Error(`Charmonator API error: ${response.statusText}`)
      }

      const data = await response.json()
      return data.response
    } catch (error) {
      console.error('Error in Charmonator chat:', error)
      throw error
    }
  }
}
