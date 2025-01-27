import { Box, TextField, Button, Stack, Paper, Typography, CircularProgress } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import { useState } from 'react'
import { chatWithLLM } from '../services/api'
import { useArtifact } from '../contexts/ArtifactContext'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addArtifact } = useArtifact()

  const parseCodeFromResponse = (response: string) => {
    // Look for code blocks with ```python
    const pythonCodeRegex = /```python\n([\s\S]*?)```/g
    const matches = [...response.matchAll(pythonCodeRegex)]
    
    matches.forEach(match => {
      const code = match[1].trim()
      // For now, we'll use the code itself as output since we're not executing it
      addArtifact(code, 'Code from chat response', 'code')
    })

    // Return the response with code blocks removed or marked
    return response.replace(pythonCodeRegex, (match, code) => {
      return `[Code added to editor]\n${match}`
    })
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    
    const userMessage: Message = {
      role: 'user',
      content: input
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setError(null)
    setIsLoading(true)

    try {
      const response = await chatWithLLM(input, {
        provider: 'ollama',
        model: 'qwen2.5'
      })

      // Parse code blocks and create artifacts
      const processedResponse = parseCodeFromResponse(response)

      const assistantMessage: Message = {
        role: 'assistant',
        content: processedResponse
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response')
      console.error('Chat error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      <Box sx={{ flex: 1, overflowY: 'auto', mb: 2 }}>
        {messages.map((message, index) => (
          <Paper 
            key={index}
            sx={{ 
              p: 2, 
              mb: 1, 
              bgcolor: message.role === 'user' ? 'primary.light' : 'secondary.light',
              ml: message.role === 'user' ? 'auto' : 0,
              mr: message.role === 'assistant' ? 'auto' : 0,
              maxWidth: '80%'
            }}
          >
            <Typography>{message.content}</Typography>
          </Paper>
        ))}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {error && (
          <Paper sx={{ p: 2, mb: 1, bgcolor: 'error.light', color: 'error.contrastText' }}>
            <Typography>{error}</Typography>
          </Paper>
        )}
      </Box>
      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          size="small"
          disabled={isLoading}
        />
        <Button 
          variant="contained" 
          onClick={handleSend}
          endIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
          disabled={isLoading || !input.trim()}
        >
          Send
        </Button>
      </Stack>
    </Box>
  )
} 