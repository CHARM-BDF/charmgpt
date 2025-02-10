import { Box, ToggleButton, ToggleButtonGroup, Button, CircularProgress } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SaveIcon from '@mui/icons-material/Save'
import Editor from './Editor'
import { useArtifact } from '../contexts/useArtifact'
import { EditorMode } from '../contexts/ArtifactContext.types'

export default function CodeEditor() {
  const { 
    mode, 
    setMode, 
    runArtifact, 
    editorContent, 
    planContent, 
    activeArtifact,
    isRunning
  } = useArtifact()

  // Add debug logging
  console.log('CodeEditor render:', {
    activeArtifact,
    hasPlot: activeArtifact?.plotFile,
    hasData: activeArtifact?.dataFile,
  })

  const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: EditorMode) => {
    if (newMode !== null) {
      setMode(newMode)
    }
  }

  const handleRun = async () => {
    console.log('Run button clicked, content:', editorContent)
    if (!editorContent) {
      console.warn('No editor content to run')
      return
    }
    try {
      await runArtifact(editorContent)
    } catch (error) {
      console.error('Error in handleRun:', error)
    }
  }

  const handleSave = () => {
    if (mode === 'plan') {
      // Create a blob with the plan content
      const blob = new Blob([planContent], { type: 'text/markdown' })
      
      // Create a temporary link element
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'plan.md'
      
      // Append link to body, click it, and remove it
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up the URL object
      URL.revokeObjectURL(link.href)
    }
  }

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      flex: 1,
    }}>
      <Box sx={{ 
        p: 1, 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        minHeight: '48px',
        flexShrink: 0,
        backgroundColor: 'background.paper',
        width: '100%',
      }}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          size="small"
        >
          <ToggleButton value="code">Code</ToggleButton>
          <ToggleButton value="plan">Plan</ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ 
          position: 'absolute',
          right: 8,
          display: 'flex',
          gap: 1,
          backgroundColor: 'background.paper',
          alignItems: 'center',
        }}>
          <Button
            variant="contained"
            size="small"
            startIcon={isRunning ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
            onClick={handleRun}
            disabled={mode === 'plan' || !editorContent || isRunning}
          >
            {isRunning ? 'Running...' : 'Run'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={mode === 'code'} // Enable save only in plan mode
          >
            Save
          </Button>
        </Box>
      </Box>
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <Editor />
      </Box>
    </Box>
  )
} 