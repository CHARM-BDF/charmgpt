import Editor from '@monaco-editor/react'
import { Box } from '@mui/material'
import { useArtifact } from '../contexts/ArtifactContext'
import { useState } from 'react'
import ActionButtons from './ActionButtons'

export default function CodeEditor() {
  const { activeArtifact, runArtifact, addArtifact } = useArtifact()
  const [currentCode, setCurrentCode] = useState<string>(activeArtifact?.code || '')

  const handleRun = () => {
    if (activeArtifact) {
      // Run with current edited code
      const artifactWithNewCode = {
        ...activeArtifact,
        code: currentCode
      }
      runArtifact(artifactWithNewCode)
    }
  }

  const handleSave = () => {
    if (currentCode.trim()) {
      addArtifact(currentCode, 'Saved code', 'code')
    }
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      <Box sx={{ mb: 2 }}>
        <ActionButtons
          onRun={handleRun}
          onSave={handleSave}
          runDisabled={!activeArtifact}
          saveDisabled={!currentCode.trim()}
        />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Editor
          height="100%"
          defaultLanguage="python"
          value={activeArtifact?.code || `# Start coding here
import pandas as pd
import numpy as np

# Your data science code goes here
`}
          onChange={(value) => setCurrentCode(value || '')}
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