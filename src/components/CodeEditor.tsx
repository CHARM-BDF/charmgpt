import Editor from '@monaco-editor/react'
import { Box } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import { useState, useEffect } from 'react'
import ActionButtons from './ActionButtons'
import { Artifact } from '../contexts/ArtifactContext.types'

export default function CodeEditor() {
  const { activeArtifact, runArtifact, updateEditorContent } = useArtifact()

  const defaultCode = `# Start coding here
import pandas as pd
import numpy as np

# Your data science code goes here
print("Hello, world!")
`

  const [currentCode, setCurrentCode] = useState<string>(defaultCode)

  // Update currentCode when activeArtifact changes
  useEffect(() => {
    if (activeArtifact?.code) {
      setCurrentCode(activeArtifact.code)
    }
  }, [activeArtifact])

  const handleRun = async () => {
    updateEditorContent(currentCode)
    
    const tempArtifact: Artifact = {
      id: Date.now(),
      code: currentCode,
      output: '',
      timestamp: new Date(),
      type: 'code',
      name: 'Code Execution',
      source: 'user',
      description: 'Code execution'
    }
    
    await runArtifact(tempArtifact)
  }

  const handleSave = () => {
    const code = currentCode
    if (code.trim()) {
      // Assuming addArtifact is called elsewhere in the code
      // addArtifact(code, 'Saved Code', 'code', { source: 'user', description: 'User saved code' })
    }
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      <Box sx={{ mb: 2 }}>
        <ActionButtons
          onRun={handleRun}
          onSave={handleSave}
          runDisabled={false}
          saveDisabled={false}
        />
      </Box>
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <Editor
          height="100%"
          defaultLanguage="python"
          value={currentCode}
          onChange={(value) => {
            setCurrentCode(value || '')
            updateEditorContent(value || '')
          }}
          theme="light"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
          }}
        />
      </Box>
    </Box>
  )
} 