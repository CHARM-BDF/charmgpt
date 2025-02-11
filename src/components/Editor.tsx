import { useCallback, useRef, useEffect } from 'react'
import { useArtifact } from '../contexts/useArtifact'
import { Box } from '@mui/material'
import MonacoEditor, { OnChange } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { dataHeader, getDisplayName, Artifact } from '../contexts/ArtifactContext.types'

export default function Editor() {
  const { 
    activeArtifact, 
    setEditorContent,
    editorContent, 
    planContent,
    setPlanContent,
    mode,
    setEditorContent: setEditorContentContext,
    setPlanContent: setPlanContentContext
  } = useArtifact()

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const isInitialMount = useRef(true)

  const insertArtifactAtCursor = useCallback((artifact: Artifact) => {
    if (!editorRef.current) return

    const editor = editorRef.current
    const position = editor.getPosition()
    if (!position) return

    let artifactSummary = `## Artifact ${getDisplayName(artifact)}`
    if (artifact.dataFile) {
      artifactSummary += `\n### Data Columns\n${dataHeader(artifact.dataFile)}`
    }
    if (artifact.chatInput) {
      artifactSummary += `\n### Chat Input\n${artifact.chatInput}`
    }
    if (artifact.code) {
      artifactSummary += `\n### Code\n\`\`\`python\n${artifact.code}\`\`\`\nOutput:\n\`\`\`\n${artifact.output}\`\`\`\n${artifact.plotFile ? `\n![Plot](${artifact.plotFile})\n` : ''}`
    }
    if (artifact.output && !artifact.dataFile) {
      artifactSummary += `\n### Output\n\`\`\`\n${artifact.output}\`\`\`\n`
    }
    if (artifact.plotFile) {
      artifactSummary += `\n### Plot\n![Plot](${artifact.plotFile})\n`
    }

    editor.executeEdits('', [{
      range: new monaco.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column
      ),
      text: artifactSummary
    }])
    
    setPlanContentContext(editor.getValue())
  }, [setPlanContentContext])

  // Handle artifact selection
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

   if (activeArtifact && mode === 'code' && activeArtifact.code) {
      setEditorContentContext(activeArtifact.code)
    }
  }, [activeArtifact, mode, setEditorContentContext])

  // Add debug logging
  useEffect(() => {
    console.log('Editor activeArtifact changed:', activeArtifact)
  }, [activeArtifact])

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
    
    const commandId = editor.addAction({
      id: 'insert-artifact',
      label: 'Insert Artifact',
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Period
      ],
      run: () => {
        if (!activeArtifact) {
          console.log('No active artifact');
          return;
        }
        insertArtifactAtCursor(activeArtifact);
      }
    });

    // Clean up command when component unmounts or activeArtifact changes
    return () => {
      commandId.dispose();
    }
  }, [activeArtifact, insertArtifactAtCursor])

  // Use effect to handle command lifecycle
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    
    return handleEditorDidMount(editor);
  }, [handleEditorDidMount]);

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