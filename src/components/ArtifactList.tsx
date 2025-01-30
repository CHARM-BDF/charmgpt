import { Box, List, ListItem, ListItemButton, ListItemText, Typography, IconButton, Tooltip } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import { formatDistanceToNow } from 'date-fns'
import AddIcon from '@mui/icons-material/Add'
import DownloadIcon from '@mui/icons-material/Download'

export default function ArtifactList() {
  const { artifacts, activeArtifact, setActiveArtifact, mode } = useArtifact()

  const getArtifactDescription = (artifact: typeof artifacts[0]) => {
    if (artifact.type === 'visualization') {
      return 'Plot generated'
    }
    // Get the first line of output, or first 50 chars if no newline
    const firstLine = artifact.output.split('\n')[0]
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine
  }

  const handleAddToPlan = (artifact: typeof artifacts[0], e: React.MouseEvent) => {
    e.stopPropagation()
    window.dispatchEvent(new CustomEvent('shouldInsertArtifact'))
    setActiveArtifact(artifact)
  }

  const handleDownloadData = (artifact: typeof artifacts[0], e: React.MouseEvent) => {
    e.stopPropagation()
    if (artifact.dataFile) {
      const link = document.createElement('a')
      link.href = `/api/artifacts/data/${artifact.dataFile}`
      link.download = artifact.dataFile
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">History</Typography>
      </Box>
      <List 
        sx={{ 
          flex: 1, 
          overflow: 'auto',
          '& .MuiListItem-root': {
            padding: 0,
          },
          '& .MuiListItemButton-root': {
            px: 2,
            py: 1,
          },
        }}
      >
        {artifacts.slice().reverse().map((artifact) => (
          <ListItem 
            key={artifact.id}
            disablePadding
            sx={{
              bgcolor: activeArtifact?.id === artifact.id ? 'action.selected' : 'transparent',
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
            secondaryAction={
              <Box sx={{ display: 'flex', gap: 1 }}>
                {mode === 'plan' && (
                  <Tooltip title="Add to plan">
                    <IconButton
                      edge="end"
                      aria-label="add to plan"
                      onClick={(e) => handleAddToPlan(artifact, e)}
                    >
                      <AddIcon />
                    </IconButton>
                  </Tooltip>
                )}
                {artifact.dataFile && (
                  <Tooltip title="Download data">
                    <IconButton
                      edge="end"
                      aria-label="download data"
                      onClick={(e) => handleDownloadData(artifact, e)}
                    >
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            }
          >
            <ListItemButton
              onClick={() => setActiveArtifact(artifact)}
              dense
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Typography
                      component="span"
                      sx={{ 
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        mr: 1
                      }}
                    >
                      {artifact.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      component="span"
                      sx={{ 
                        color: 'text.secondary',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {formatDistanceToNow(artifact.timestamp, { addSuffix: true })}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: 'text.secondary'
                    }}
                  >
                    {getArtifactDescription(artifact)}
                  </Typography>
                }
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  )
} 