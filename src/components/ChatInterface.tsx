import { Box, TextField, Button, Stack, Typography, CircularProgress, IconButton } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { useState, useRef } from 'react'
import { chatWithLLM } from '../services/api'
import { useArtifact } from '../contexts/useArtifact'
import { ArtifactType } from '../contexts/ArtifactContext.types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const ALLOWED_FILE_TYPES = {
  'text/csv': {
    extensions: ['.csv'],
    description: 'CSV dataset',
    codeExample: (filepath: string) => `import pandas as pd\ndf = pd.read_csv("${filepath}")`
  },
  'application/json': {
    extensions: ['.json'],
    description: 'JSON data',
    codeExample: (filepath: string) => `import json\nwith open("${filepath}", "r") as f:\n    data = json.load(f)`
  },
  'text/plain': {
    extensions: ['.txt'],
    description: 'Text file',
    codeExample: (filepath: string) => `with open("${filepath}", "r") as f:\n    text = f.read()`
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    extensions: ['.xlsx'],
    description: 'Excel file',
    codeExample: (filepath: string) => `import pandas as pd\ndf = pd.read_excel("${filepath}")`
  }
}

function getArtifactTypeFromFile(filename: string): ArtifactType {
  const ext = filename.split('.').pop()?.toLowerCase()
  
  switch (ext) {
    case 'csv':
    case 'json':
    case 'txt':
      return 'data'
    case 'py':
    case 'js':
    case 'ts':
      return 'code'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
      return 'visualization'
    default:
      return 'data' // default to data type
  }
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addArtifact, setEditorContent, setMode, runArtifact } = useArtifact()

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to upload file')
      }

      const result = await response.json()
      
      // Get file extension and type info
      const fileExt = file.name.split('.').pop()?.toLowerCase()
      const fileType = Object.values(ALLOWED_FILE_TYPES).find(info => 
        info.extensions.includes(`.${fileExt}`)
      )

      // Add as an artifact with the correct type
      addArtifact({
        name: file.name,
        type: getArtifactTypeFromFile(file.name),
        output: `File uploaded: ${file.name}`,
        dataFile: result.filepath,
      })

      // Add message about the uploaded file
      setMessages(prev => [...prev, {
        role: 'user',
        content: `Uploaded ${fileType?.description || 'file'}: ${file.name}`
      }])

      // Add system message about how to use the file
      if (fileType) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `File "${file.name}" is now available. You can access it using:\n\`\`\`python\n${fileType.codeExample(result.filepath)}\n\`\`\``
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `File "${file.name}" has been uploaded to "${result.filepath}"`
        }])
      }

      setError(null)
    } catch (err) {
      console.error('Failed to upload file:', err)
      setError(err instanceof Error ? err.message : 'Failed to upload file')
    }
  }

  const parseCodeFromResponse = async (response: string, input: string) => {
    // Look for code blocks with ```python
    const codeBlockRegex = /```python\n([\s\S]*?)```/g
    const matches = [...response.matchAll(codeBlockRegex)]
    
    // Create a concise title from the user's input
    const artifactName = input.length > 50 ? input.substring(0, 47) + '...' : input
    
    // Get the last code block to set in editor
    const lastCodeBlock = matches[matches.length - 1]
    
    for (const match of matches) {
      if (match[1]) {
        const code = match[1].trim()
        
        // If this is the last code block, set it in the editor and run it
        if (match === lastCodeBlock) {
          setMode('code')
          setEditorContent(code)
          try {
            // Let runArtifact handle the artifact creation and execution
            await runArtifact(code, artifactName)
          } catch (err) {
            console.error('Failed to run code:', err)
            // Only add artifact if execution failed
            addArtifact({
              type: 'code',
              name: artifactName,
              code,
              output: err instanceof Error ? err.message : 'Failed to run code',
              plotFile: undefined,
              dataFile: undefined,
              source: 'assistant'
            })
          }
        }
      }
    }

    // Return the response with code blocks removed for chat display
    return response.replace(codeBlockRegex, '[Code added to editor and executed]')
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
                whiteSpace: 'pre-wrap',
                fontFamily: message.content.includes('```') ? 'monospace' : 'inherit'
              }}
            >
              {message.content}
            </Typography>
          </Box>
        ))}
        {error && (
          <Typography color="error" variant="body2">{error}</Typography>
        )}
      </Box>
      
      <Stack direction="row" spacing={1} alignItems="center">
        <input
          type="file"
          accept={Object.values(ALLOWED_FILE_TYPES)
            .flatMap(info => info.extensions)
            .join(',')}
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
        <IconButton 
          onClick={() => fileInputRef.current?.click()}
          size="small"
          title="Upload CSV dataset"
        >
          <UploadFileIcon />
        </IconButton>
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
          Send
        </Button>
      </Stack>
    </Box>
  )
} 