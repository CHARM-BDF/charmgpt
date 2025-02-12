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
      const ok = await handleChat(input)

      // Add assistant message to chat
      const assistantMessage: Message = {
        role: 'assistant',
        content: ok ? 'Response added to artifacts' : 'Error'
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
            onKeyDown={(e) => {  // Change to onKeyDown for better control
              if (e.key === 'Enter') {
                if (e.shiftKey) {
                  // Let Shift+Enter add a newline
                  return
                }
                // Regular Enter sends the message
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Type your message... (Shift+Enter for new line)"
            disabled={isLoading}
            multiline
            minRows={2}
            maxRows={8}
            sx={{
              '& .MuiOutlinedInput-root': {
                alignItems: 'flex-start'
              }
            }}
          />
          <IconButton 
            onClick={handleSend} 
            disabled={!input.trim() || isLoading}
            color="primary"
            sx={{ mt: 0.5 }}  // Align with first line of text
          >
            {isLoading ? <CircularProgress size={24} /> : <SendIcon />}
          </IconButton>
        </Box>
      </Box>
    </Box>
  )
} 