import { Box, ToggleButton, ToggleButtonGroup, Button } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SaveIcon from '@mui/icons-material/Save'
import Editor from './Editor'
import { useArtifact } from '../contexts/useArtifact'
import { EditorMode } from '../contexts/ArtifactContext.types'

export default function CodeEditor() {
  const { mode, setMode, runArtifact, editorContent } = useArtifact()

  const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: EditorMode) => {
    if (newMode !== null) {
      setMode(newMode)
    }
  }

  const handleRun = () => {
    runArtifact(editorContent)
  }

  const handleSave = () => {
    // TODO: Implement save functionality
    console.log('Save clicked')
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
        >
          Run
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<SaveIcon />}
          onClick={handleSave}
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