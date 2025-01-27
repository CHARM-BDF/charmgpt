import Editor from '@monaco-editor/react'
import { Box } from '@mui/material'
import { useArtifact } from '../contexts/ArtifactContext'

export default function CodeEditor() {
  const { activeArtifact } = useArtifact()

  return (
    <Box sx={{ height: '100%', p: 2 }}>
      <Editor
        height="100%"
        defaultLanguage="python"
        value={activeArtifact?.code || `# Start coding here
import pandas as pd
import numpy as np

# Your data science code goes here
`}
        theme="light"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
        }}
      />
    </Box>
  )
} 