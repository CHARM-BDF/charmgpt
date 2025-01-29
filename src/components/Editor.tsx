import React, { useEffect } from 'react'
import { useArtifact } from '../contexts/useArtifact'
import MonacoEditor from '@monaco-editor/react'

export default function Editor() {
  const { activeArtifact, editorContent, updateEditorContent } = useArtifact()

  useEffect(() => {
    if (activeArtifact) {
      updateEditorContent(activeArtifact.code)
    }
  }, [activeArtifact])

  return (
    <MonacoEditor
      value={editorContent}
      onChange={value => updateEditorContent(value || '')}
      // ... other props
    />
  )
} 