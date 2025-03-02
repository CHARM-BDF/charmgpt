import { Router } from 'express'
import { LLMService, LLMConfig, createLLMService } from '../services/llm/index'

const router = Router()

// Store LLM instances for different configurations
const llmInstances = new Map<string, LLMService>()

function getLLMInstance(config: LLMConfig): LLMService {
  const key = config ? `${config.provider}-${config.model}` : ""
  if (!llmInstances.has(key)) {
    llmInstances.set(key, createLLMService(config))
  }
  return llmInstances.get(key)!
}

router.post('/chat', async (req, res) => {
  try {
    const { message, config } = req.body
    const llm = getLLMInstance(config)
    console.log("Chatting with message:", message);
    const response = await llm.chat(message)
    res.json({ response })
  } catch (error) {
    console.error('Error in chat endpoint:', error)
    res.status(500).json({ error: 'Error processing chat request' })
  }
})

export { router as LLMRouter } 