import { Router } from 'express'
import { LLMService, LLMConfig } from '../services/llm'

const router = Router()

// Store LLM instances for different configurations
const llmInstances = new Map<string, LLMService>()

function getLLMInstance(config: LLMConfig): LLMService {
  const key = `${config.provider}-${config.model}`
  if (!llmInstances.has(key)) {
    llmInstances.set(key, new LLMService(config))
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

router.post('/generate-code', async (req, res) => {
  try {
    const { prompt, config } = req.body
    const llm = getLLMInstance(config)
    console.log("Generating code with prompt:", prompt);
    const code = await llm.generateCode(prompt)
    res.json({ code })
  } catch (error) {
    console.error('Error in code generation endpoint:', error)
    res.status(500).json({ error: 'Error generating code' })
  }
})

export { router as LLMRouter } 