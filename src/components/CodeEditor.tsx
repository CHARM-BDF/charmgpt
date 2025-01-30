import { Box, ToggleButton, ToggleButtonGroup, Button } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SaveIcon from '@mui/icons-material/Save'
import Editor from './Editor'
import { useArtifact } from '../contexts/useArtifact'
import { EditorMode } from '../contexts/ArtifactContext.types'

export default function CodeEditor() {
  const { mode, setMode, runArtifact, editorContent, planContent } = useArtifact()

  const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: EditorMode) => {
    if (newMode !== null) {
      setMode(newMode)
    }
  }

  const handleRun = () => {
    if (mode === 'code') {
      runArtifact(editorContent)
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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ 
        p: 1, 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 2
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
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          size="small"
          startIcon={<PlayArrowIcon />}
          onClick={handleRun}
          disabled={mode === 'plan'}
        >
          Run
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
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <Editor />
      </Box>
    </Box>
  )
} 