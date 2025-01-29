import Editor from '@monaco-editor/react'
import { Box } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import { useState, useEffect } from 'react'
import ActionButtons from './ActionButtons'

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
    await runArtifact(currentCode)
  }

  const handleSave = () => {
    // Implement save functionality if needed
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