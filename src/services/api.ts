import { LLMConfig } from '../../server/src/services/llm'

const API_BASE_URL = 'http://localhost:3000/api'

export const chatWithLLM = async (message: string, config: LLMConfig) => {
  const response = await fetch(`${API_BASE_URL}/llm/chat`, {
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
  const response = await fetch(`${API_BASE_URL}/llm/generate-code`, {
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

interface MarkdownResponse {
  markdownContent: string
}

export const convertToMarkdown = async (file: File): Promise<string> => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/service/charmonator/conversion/file', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Failed to convert file')
  }

  const data = await response.json() as MarkdownResponse
  return data.markdownContent
} 