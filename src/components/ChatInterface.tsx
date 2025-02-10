import { Box, TextField, Button, Stack, Typography, CircularProgress } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import { useState } from 'react'
import { chatWithLLM } from '../services/api'
import { useArtifact } from '../contexts/useArtifact'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addArtifact, setEditorContent, setMode, runArtifact, generateSummary } = useArtifact()

 
  const parseCodeFromResponse = async (response: string, input: string) => {
    const codeBlockRegex = /```python\n([\s\S]*?)```/g
    const matches = [...response.matchAll(codeBlockRegex)]
    
    if (matches.length > 0) {
      const artifactName = input.length > 50 ? input.substring(0, 47) + '...' : input
      
      // Join all code blocks with newlines between them
      const combinedCode = matches
        .map(match => match[1].trim())
        .join('\n\n')
      
      // Add the chat input as a comment at the top of the code
      const codeWithComment = `"""Query: ${input}\n"""\n\n${combinedCode}`
      
      setMode('code')
      setEditorContent(codeWithComment)
      try {
        await runArtifact(codeWithComment, artifactName, input)
      } catch (err) {
        console.error('Failed to run code:', err)
        addArtifact({
          type: 'code',
          name: artifactName,
          code: codeWithComment,
          output: err instanceof Error ? err.message : 'Failed to run code',
          plotFile: undefined,
          dataFile: undefined,
          source: 'assistant',
          chatInput: input
        })
      }
    }

    return response.replace(codeBlockRegex, '[Code added to editor and executed]')
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    
    let msg = await generateSummary() + '\n' + input
    msg = msg.trim()

    const userMessage: Message = {
      role: 'user',
      content: msg
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setError(null)
    setIsLoading(true)

    try {
      const response = await chatWithLLM(msg, {
        provider: 'ollama',
        model: 'qwen2.5'
      })

      // Parse code blocks and create artifacts
      const processedResponse = await parseCodeFromResponse(response, input)

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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 1 }}>
      {(messages.length == 0) ? (
          <Box sx={{ flex: 1, overflow: 'auto', p: 2}}>
          <Typography sx={{ fontStyle: 'italic', color: 'text.disabled' }}>
            (chat history)
          </Typography>
        </Box>
        ) : (
      <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
        {messages.map((message, index) => (
          <Box 
            key={index} 
            sx={{ 
              mb: 1,
              p: 1,
              backgroundColor: message.role === 'assistant' ? 'action.hover' : 'transparent',
              borderRadius: 1
            }}
          >
            <Typography 
              variant="body2" 
              sx={{ 
                whiteSpace: 'pre-wrap'
              }}
            >
              {message.content}
            </Typography>
          </Box>
        ))}
        {error && (
          <Typography color="error" variant="body2">{error}</Typography>
        )}
      </Box>)}
      
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          fullWidth
          size="small"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSend()}
          placeholder="Ask about your data..."
          disabled={isLoading}
        />
        <Button
          variant="contained"
          endIcon={isLoading ? <CircularProgress size={20} /> : <SendIcon />}
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
        >
        </Button>
      </Stack>
    </Box>
  )
} 