import { ButtonGroup, Button } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SaveIcon from '@mui/icons-material/Save'

interface ActionButtonsProps {
  onRun?: () => void
  onSave?: () => void
  runDisabled?: boolean
  saveDisabled?: boolean
}

export default function ActionButtons({ 
  onRun, 
  onSave, 
  runDisabled = false, 
  saveDisabled = false 
}: ActionButtonsProps) {
  return (
    <ButtonGroup variant="contained" size="small">
      {onRun && (
        <Button
          onClick={onRun}
          startIcon={<PlayArrowIcon />}
          disabled={runDisabled}
        >
          Run
        </Button>
      )}
      {onSave && (
        <Button
          onClick={onSave}
          startIcon={<SaveIcon />}
          disabled={saveDisabled}
        >
          Save
        </Button>
      )}
    </ButtonGroup>
  )
} 