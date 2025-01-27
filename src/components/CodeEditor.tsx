import Editor from '@monaco-editor/react'
import { Box } from '@mui/material'

export default function CodeEditor() {
  return (
    <Box sx={{ height: '100%', p: 2 }}>
      <Editor
        height="100%"
        defaultLanguage="python"
        defaultValue="# Start coding here
import pandas as pd
import numpy as np

# Your data science code goes here
"
        theme="light"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
        }}
      />
    </Box>
  )
} 