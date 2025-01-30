import React, { useEffect } from 'react'
import { useArtifact } from '../contexts/useArtifact'
import MonacoEditor from '@monaco-editor/react'

const DEFAULT_CODE = `# Start coding here
import pandas as pd
import numpy as np

# Your data science code goes here
print("Hello, world!")`

export default function Editor() {
  const { activeArtifact, updateEditorContent, editorContent } = useArtifact()

  useEffect(() => {
    if (activeArtifact) {
      updateEditorContent(activeArtifact.code)
    }
  }, [activeArtifact, updateEditorContent])

  return (
    <MonacoEditor
      value={editorContent || activeArtifact?.code || DEFAULT_CODE}
      onChange={value => updateEditorContent(value || '')}
      height="100%"
      language="python"
      theme="light"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
      }}
    />
  )
} 