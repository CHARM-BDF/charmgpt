import { useCallback, useRef, useEffect, useMemo } from 'react'
import { useArtifact } from '../contexts/useArtifact'
import { Box, Typography } from '@mui/material'
import MonacoEditor, { OnChange } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { dataHeader, getDisplayName, Artifact, ViewMode } from '../contexts/ArtifactContext.types'
import { DataViewer } from './DataViewer'
import '../styles/editor.css'

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
    setPlanContent: setPlanContentContext,
    setSelectedStep,
    selectedStep
  } = useArtifact()

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const isInitialMount = useRef(true)
  const decorationIds = useRef<string[]>([])
  
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

  // Add debounce to avoid rapid switches
  const debouncedSetViewMode = useMemo(() => {
    let timeout: NodeJS.Timeout
    return (mode: ViewMode) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => setViewMode(mode), 100)
    }
  }, [setViewMode])

  // Update cursor position handler
  const handleEditorDidMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor
    
    editor.onDidChangeCursorPosition((e) => {
      // Get word at cursor position
      const model = editor.getModel()
      if (!model) return

      const word = model.getWordAtPosition(e.position)
      if (!word) return

      // Check if this word is a variable we're tracking
      if (activeArtifact?.var2line && word.word in activeArtifact.var2line) {
        const varName = word.word
        setSelectedStep(varName)
        debouncedSetViewMode('data')
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
  }, [activeArtifact, debouncedSetViewMode, insertArtifactAtCursor, mode, setSelectedStep])

  // Update step finding logic for the side panel
  const currentStepData = useMemo(() => {
    if (!activeArtifact?.var2line || !activeArtifact?.var2val) return null
    
    const model = editorRef.current?.getModel()
    if (!model) return null

    const position = editorRef.current?.getPosition()
    if (!position) return null

    const word = model.getWordAtPosition(position)
    if (!word) return null

    const varName = word.word
    if (!(varName in activeArtifact.var2val)) return null

    const varInfo = activeArtifact.var2val[varName]
    if (!varInfo) return null
    
    return {
      step: varName,
      file: varInfo.type === 'file' ? varInfo.value : undefined
    }
  }, [activeArtifact])

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

  const handleChange: OnChange = (value) => {
    if (value === undefined) return
    
    if (mode === 'code') {
      setEditorContent(value)
    } else {
      setPlanContent(value)
    }
  }

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

  // Add effect to handle line highlighting when selectedStep changes
  useEffect(() => {
    if (!editorRef.current || !activeArtifact?.var2line || !activeArtifact?.var2line_end) return
    
    const editor = editorRef.current
    
    // Clear existing decorations
    decorationIds.current = editor.deltaDecorations(decorationIds.current, [])
    
    if (selectedStep) {
      const startLine = activeArtifact.var2line[selectedStep]
      const endLine = activeArtifact.var2line_end?.[selectedStep] || startLine
      
      // Add new decoration
      const newDecorations = [{
        range: new monaco.Range(startLine, 1, endLine, 1),
        options: {
          isWholeLine: true,
          className: 'highlighted-line',
          linesDecorationsClassName: 'highlighted-line-gutter'
        }
      }]
      
      decorationIds.current = editor.deltaDecorations([], newDecorations)
    }
  }, [selectedStep, activeArtifact?.var2line, activeArtifact?.var2line_end])

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