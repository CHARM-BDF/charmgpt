import Editor from '@monaco-editor/react'
import { Box } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import { useState } from 'react'
import ActionButtons from './ActionButtons'
import { Artifact } from '../contexts/ArtifactContext.types'

export default function CodeEditor() {
  const { activeArtifact, runArtifact, addArtifact, updateEditorContent } = useArtifact()
  const [currentCode, setCurrentCode] = useState<string>('')

  const defaultCode = `# Start coding here
import pandas as pd
import numpy as np

# Your data science code goes here
print("Hello, world!")
`

  const getEffectiveCode = () => currentCode || activeArtifact?.code || defaultCode

  const handleRun = async () => {
    const code = getEffectiveCode()
    updateEditorContent(code)
    
    // Create a temporary artifact with the current code
    const tempArtifact: Artifact = {
      id: Date.now(),
      code: code,  // Use the current code
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
    const code = getEffectiveCode()
    if (code.trim()) {
      addArtifact(
        code,
        'Saved Code',
        'code',
        {
          source: 'user',
          description: 'User saved code'
        }
      )
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
          value={activeArtifact?.code || defaultCode}
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