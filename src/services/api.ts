import { LLMConfig } from '../../server/src/services/llm'

export const chatWithLLM = async (message: string, config?: LLMConfig) => {
  const response = await fetch(`/api/llm/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, config }),
  })
  
  if (!response.ok) {
    throw new Error('Failed to chat with LLM')
  }
  
  const data = await response.json()
  return data.response
}

export const generateCode = async (prompt: string, config: LLMConfig) => {
  const response = await fetch(`/api/llm/generate-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, config }),
  })
  
  if (!response.ok) {
    throw new Error('Failed to generate code')
  }
  
  const data = await response.json()
  return data.code
} 