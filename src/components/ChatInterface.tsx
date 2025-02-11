import { Box, TextField, IconButton, Typography, CircularProgress } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import { useState } from 'react'
import { useArtifact } from '../contexts/useArtifact'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { handleChat } = useArtifact()

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    // Add user message to chat
    const userMessage: Message = {
      role: 'user',
      content: input
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Process through artifact system
      await handleChat(input)

      // Add assistant message to chat
      const assistantMessage: Message = {
        role: 'assistant',
        content: 'Response added to artifacts'
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      console.error('Chat error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Messages area */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}>
        {messages.map((message, index) => (
          <Box 
            key={index}
            sx={{
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              backgroundColor: message.role === 'user' ? 'primary.main' : 'grey.100',
              color: message.role === 'user' ? 'white' : 'text.primary',
              borderRadius: 2,
              p: 1,
            }}
          >
            <Typography>{message.content}</Typography>
          </Box>
        ))}
      </Box>

      {/* Input area */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <IconButton 
            onClick={handleSend} 
            disabled={!input.trim() || isLoading}
            color="primary"
          >
            {isLoading ? <CircularProgress size={24} /> : <SendIcon />}
          </IconButton>
        </Box>
      </Box>
    </Box>
  )
} 