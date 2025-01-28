import { LLMService } from './index'

export class OllamaService implements LLMService {
  constructor(private baseUrl: string) {}

  async chat(message: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen2.5',
        messages: [
          { role: 'user', content: message }
        ]
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data.message.content
  }
} 