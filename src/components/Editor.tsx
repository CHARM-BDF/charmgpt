import { useCallback, useRef, useEffect } from 'react'
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
    artifacts,
    setActiveArtifact
  } = useArtifact()

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const isInitialMount = useRef(true)

  const insertArtifactAtCursor = useCallback((artifact: typeof artifacts[0]) => {
    if (!editorRef.current) return

    const editor = editorRef.current
    const position = editor.getPosition()
    if (!position) return

    const artifactSummary = `
## Artifact #${artifact.id} - ${artifact.name}
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
    editor.executeEdits('', [{
      range: new monaco.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column
      ),
      text: artifactSummary
    }])
    
    // Update the plan content after insertion
    updatePlanContent(editor.getValue())
    // Clear active artifact after insertion
    setActiveArtifact(null)
  }, [updatePlanContent, setActiveArtifact])

  // Handle artifact selection
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    if (activeArtifact && mode === 'plan') {
      insertArtifactAtCursor(activeArtifact)
    } else if (activeArtifact && mode === 'code') {
      updateEditorContent(activeArtifact.code)
    }
  }, [activeArtifact, mode, updateEditorContent, insertArtifactAtCursor])

  const handleEditorChange = (value: string | undefined) => {
    if (mode === 'plan') {
      updatePlanContent(value || '')
    } else {
      updateEditorContent(value || '')
    }
  }

  const handleEditorDidMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor
    
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
          insertArtifactAtCursor(artifact)
        }
      }
    })
  }, [artifacts, insertArtifactAtCursor])

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