import React, { useEffect } from 'react'
import { useArtifact } from '../contexts/useArtifact'
import MonacoEditor from '@monaco-editor/react'

export default function Editor() {
  const { activeArtifact, updateEditorContent } = useArtifact()

  useEffect(() => {
    if (activeArtifact) {
      updateEditorContent(activeArtifact.code)
    }
  }, [activeArtifact, updateEditorContent])

  return (
    <MonacoEditor
      value={activeArtifact?.code || ''}
      onChange={value => updateEditorContent(value || '')}
      // ... other props
    />
  )
} 