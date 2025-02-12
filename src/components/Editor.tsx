import { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import { useArtifact } from '../contexts/useArtifact'
import { Box, Typography } from '@mui/material'
import MonacoEditor, { OnChange } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { dataHeader, getDisplayName, Artifact } from '../contexts/ArtifactContext.types'
import DataViewer from './DataViewer'

export default function Editor() {
  const { 
    activeArtifact, 
    setEditorContent,
    editorContent, 
    planContent,
    setPlanContent,
    mode,
    setViewMode,
    setEditorContent: setEditorContentContext,
    setPlanContent: setPlanContentContext
  } = useArtifact()

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const isInitialMount = useRef(true)
  const [cursorLine, setCursorLine] = useState(1)
  
  // Find data for current line
  const currentStepData = useMemo(() => {
    if (!activeArtifact?.lineNumbers) {
      console.log('No lineNumbers in artifact:', activeArtifact)
      return null
    }
    
    console.log('Looking for line:', cursorLine, 'in lineNumbers:', activeArtifact.lineNumbers)
    
    const matchingStep = Object.entries(activeArtifact.lineNumbers)
      .find(([, line]) => Number(line) === cursorLine)
    
    console.log('Found matching step:', matchingStep)
    
    if (!matchingStep) return null
    
    const [step] = matchingStep
    const result = {
      step,
      file: activeArtifact.dataFiles[step]
    }
    console.log('Current step data:', result)
    return result
  }, [activeArtifact, cursorLine])

  const insertArtifactAtCursor = useCallback((artifact: Artifact, quoted: boolean = false) => {
    if (!editorRef.current) return

    const editor = editorRef.current
    const position = editor.getPosition()
    if (!position) return

    let artifactSummary = `## Artifact ${getDisplayName(artifact)}`
    if (artifact.dataFile) {
      artifactSummary += `\n### Data Columns\n${dataHeader(artifact.dataFile)}\n`
    }
    if (artifact.chatInput) {
      artifactSummary += `\n### Chat Input\n${artifact.chatInput}\n`
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

    if (quoted) {
      artifactSummary = `"""\n${artifactSummary}\n"""\n`
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
    
    // Add cursor position listener
    editor.onDidChangeCursorPosition((e) => {
      console.log('Cursor moved to line:', e.position.lineNumber)
      setCursorLine(e.position.lineNumber)
      
      // If we have data for this line, switch to data view
      const line = e.position.lineNumber
      const hasDataForLine = activeArtifact?.lineNumbers && 
        Object.values(activeArtifact.lineNumbers).includes(line)
      
      if (hasDataForLine) {
        setViewMode('data')
      }
    })

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
        insertArtifactAtCursor(activeArtifact, mode === 'code');
      }
    });

    // Clean up command when component unmounts or activeArtifact changes
    return () => {
      commandId.dispose();
    }
  }, [activeArtifact, insertArtifactAtCursor, mode, setViewMode])

  // Use effect to handle command lifecycle
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    
    return handleEditorDidMount(editor);
  }, [handleEditorDidMount]);

  // Add effect to update language when mode changes
  useEffect(() => {
    if (!editorRef.current) return
    
    const model = editorRef.current.getModel()
    if (!model) return

    monaco.editor.setModelLanguage(model, mode === 'code' ? 'python' : 'markdown')
  }, [mode])

  const currentValue = mode === 'code' ? editorContent : planContent

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      <Box sx={{ flex: 1 }}>
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
            wordWrap: 'on',
            language: mode === 'code' ? 'python' : 'markdown'
          }}
        />
      </Box>
      
      {currentStepData && (
        <Box sx={{ width: '300px', borderLeft: 1, borderColor: 'divider', p: 1 }}>
          <Typography variant="subtitle2">
            Step: {currentStepData.step}
          </Typography>
          <DataViewer 
            dataFile={currentStepData.file}
            height="calc(100% - 32px)"  // Subtract header height
          />
        </Box>
      )}
    </Box>
  )
} 