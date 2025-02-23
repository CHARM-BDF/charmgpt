import { LLMService } from './index'
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiService implements LLMService {
   private client: GoogleGenerativeAI;
   private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({ model: "gemini-2.0-flash" });
  }

  async chat(message: string): Promise<string> {
    const result = await this.model.generateContent(message);
    const content = result.response.text();
    return content;
  }
} 