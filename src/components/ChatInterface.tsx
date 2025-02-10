import { useState, useRef, useEffect } from 'react'
import { Box, TextField, IconButton, Tooltip } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import { useChat } from '../contexts/ChatContext'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatInterface() {
  const { messages, sendMessage } = useChat()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    await sendMessage(input)
    setInput('')
  }

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      p: 1
    }}>
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto',
        mb: 2
      }}>
        {messages.map((msg: Message, index: number) => (
          <Box
            key={index}
            sx={{
              p: 1,
              mb: 1,
              bgcolor: msg.role === 'user' ? 'primary.light' : 'background.paper',
              borderRadius: 1,
            }}
          >
            <pre style={{ 
              margin: 0, 
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit'
            }}>
              {msg.content}
            </pre>
          </Box>
        ))}
        <div ref={messagesEndRef} />
      </Box>

      <Box 
        component="form" 
        onSubmit={handleSubmit}
        sx={{ 
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          backgroundColor: 'background.paper',
          p: 1,
          borderRadius: 1
        }}
      >
        <TextField
          multiline
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          variant="outlined"
          size="small"
          sx={{ 
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'background.paper'
            }
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span>
            <Tooltip title="Send message">
              <span>
                <IconButton 
                  type="submit" 
                  color="primary" 
                  disabled={!input.trim()}
                >
                  <SendIcon />
                </IconButton>
              </span>
            </Tooltip>
          </span>
        </Box>
      </Box>
    </Box>
  )
} 