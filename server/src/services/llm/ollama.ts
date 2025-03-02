import { LLMService } from './index'
import { Ollama } from 'ollama'

export class OllamaService implements LLMService {
  private baseUrl: string;
  private service: Ollama;
  private model: string;

  constructor(baseUrl: string, model?: string) {
    this.baseUrl = baseUrl;
    this.model = model || 'qwen2.5';
    this.service = new Ollama({
      host: this.baseUrl,
    });
  }

  async chat(message: string): Promise<string> {
    const response = await this.service.chat({
      model: this.model,
      messages: [{ role: 'user', content: message }]
    })  
    console.log(response.message.content)
    return response.message.content;
  }
} 