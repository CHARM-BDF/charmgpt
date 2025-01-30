import { useCallback, useRef, useEffect } from 'react'
import { useArtifact } from '../contexts/useArtifact'
import { Box } from '@mui/material'
import MonacoEditor, { OnChange } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

export default function Editor() {
  const { 
    activeArtifact, 
    setEditorContent,
    editorContent, 
    planContent,
    setPlanContent,
    mode, 
    artifacts,
    setActiveArtifact,
    setEditorContent: setEditorContentContext,
    setPlanContent: setPlanContentContext
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
    setPlanContentContext(editor.getValue())
    // Clear active artifact after insertion
    setActiveArtifact(null)
  }, [setPlanContentContext, setActiveArtifact])

  // Handle artifact selection
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    if (activeArtifact && mode === 'plan') {
      insertArtifactAtCursor(activeArtifact)
    } else if (activeArtifact && mode === 'code' && activeArtifact.code) {
      setEditorContentContext(activeArtifact.code)
    }
  }, [activeArtifact, mode, setEditorContentContext, insertArtifactAtCursor])

  const handleChange: OnChange = (value) => {
    if (value === undefined) return
    
    console.log('Editor change:', { mode, value })
    
    if (mode === 'code') {
      setEditorContent(value)
    } else {
      setPlanContent(value)
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

  const currentValue = mode === 'code' ? editorContent : planContent

  return (
    <Box sx={{ height: '100%' }}>
      <MonacoEditor
        height="100%"
        defaultLanguage={mode === 'code' ? 'python' : 'markdown'}
        value={currentValue}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          wordWrap: 'on'
        }}
      />
    </Box>
  )
} 