import { Box, TextField, Button, Stack, Paper, List, ListItem, Typography, Divider } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import CodeIcon from '@mui/icons-material/Code'
import BarChartIcon from '@mui/icons-material/BarChart'
import { useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Artifact {
  id: number
  code: string
  output: string
  timestamp: Date
  type: 'visualization' | 'code'
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [artifacts] = useState<Artifact[]>([
    {
      id: 1,
      code: 'df.head()',
      output: 'DataFrame preview...',
      timestamp: new Date(),
      type: 'code'
    },
    {
      id: 2,
      code: 'plt.plot(df["column"])',
      output: 'Line chart visualization',
      timestamp: new Date(),
      type: 'visualization'
    },
    // Add more sample artifacts as needed
  ])

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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Artifacts Section */}
      <Box sx={{ 
        height: '50%', 
        borderBottom: 1, 
        borderColor: 'divider',
        overflow: 'auto',
        p: 2
      }}>
        <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
          Artifacts
        </Typography>
        <List sx={{ p: 0 }}>
          {artifacts.map((artifact) => (
            <ListItem 
              key={artifact.id}
              sx={{ 
                mb: 1, 
                bgcolor: 'grey.50',
                borderRadius: 1,
                flexDirection: 'column',
                alignItems: 'flex-start'
              }}
            >
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                width: '100%',
                mb: 1
              }}>
                {artifact.type === 'code' ? <CodeIcon sx={{ mr: 1 }} /> : <BarChartIcon sx={{ mr: 1 }} />}
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {artifact.timestamp.toLocaleTimeString()}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                {artifact.code}
              </Typography>
              <Divider sx={{ width: '100%', my: 1 }} />
              <Typography variant="body2">
                {artifact.output}
              </Typography>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Chat Section */}
      <Box sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        p: 2
      }}>
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
    </Box>
  )
} 