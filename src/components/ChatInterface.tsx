import { Box, TextField, Button, Stack, Paper } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import { useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')

  const handleSend = () => {
    if (!input.trim()) return
    
    const newMessage: Message = {
      role: 'user',
      content: input
    }
    
    setMessages([...messages, newMessage])
    setInput('')
    // Here you would typically make an API call to your LLM service
  }

  return (
    <Box sx={{ height: '100%', p: 2, display: 'flex', flexDirection: 'column' }}>
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
            {message.content}
          </Paper>
        ))}
      </Box>
      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          size="small"
        />
        <Button 
          variant="contained" 
          onClick={handleSend}
          endIcon={<SendIcon />}
        >
          Send
        </Button>
      </Stack>
    </Box>
  )
} 