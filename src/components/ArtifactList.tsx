import { Box, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import { formatDistanceToNow } from 'date-fns'

export default function ArtifactList() {
  const { artifacts, activeArtifact, setActiveArtifact } = useArtifact()

  const getArtifactDescription = (artifact: typeof artifacts[0]) => {
    if (artifact.type === 'visualization') {
      return 'Plot generated'
    }
    // Get the first line of output, or first 50 chars if no newline
    const firstLine = artifact.output.split('\n')[0]
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine
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