import { useEffect, useCallback } from 'react'
import { useArtifact } from '../contexts/useArtifact'
import MonacoEditor from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

export default function Editor() {
  const { 
    activeArtifact, 
    updateEditorContent, 
    editorContent, 
    planContent,
    updatePlanContent,
    mode, 
    artifacts 
  } = useArtifact()

  useEffect(() => {
    if (activeArtifact && mode === 'code') {
      updateEditorContent(activeArtifact.code)
    }
  }, [activeArtifact, updateEditorContent, mode])

  const handleEditorChange = (value: string | undefined) => {
    if (mode === 'plan') {
      updatePlanContent(value || '')
    } else {
      updateEditorContent(value || '')
    }
  }

  const handleEditorDidMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor) => {
    // Add command to expand artifact references
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
      const position = editor.getPosition()
      if (!position) return

      const model = editor.getModel()
      if (!model) return

      const line = model.getLineContent(position.lineNumber)
      const artifactMatch = line.match(/\[\[(\d+)\]\]/)
      
      if (artifactMatch) {
        const artifactId = parseInt(artifactMatch[1])
        const artifact = artifacts.find(a => a.id === artifactId)
        
        if (artifact) {
          const artifactSummary = `
## Artifact ${artifact.id} - ${artifact.name}
\`\`\`python
${artifact.code}
\`\`\`

Output:
\`\`\`
${artifact.output}
\`\`\`
${artifact.plotFile ? `\n![Plot](${artifact.plotFile})\n` : ''}
---
`
          // Replace the [[id]] with the expanded content
          const range = new monaco.Range(
            position.lineNumber,
            line.indexOf('[['),
            position.lineNumber,
            line.indexOf(']]') + 2
          )
          editor.executeEdits('expand-artifact', [{
            range,
            text: artifactSummary,
          }])
        }
      }
    })
  }, [artifacts])

  return (
    <MonacoEditor
      value={mode === 'code' ? editorContent : planContent}
      onChange={handleEditorChange}
      onMount={handleEditorDidMount}
      height="100%"
      language={mode === 'code' ? 'python' : 'markdown'}
      theme="light"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: mode === 'plan' ? 'on' : 'off',
        lineNumbers: mode === 'code' ? 'on' : 'off',
      }}
    />
  )
} 