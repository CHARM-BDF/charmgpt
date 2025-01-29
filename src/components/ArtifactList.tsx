import { Box, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import { formatDistanceToNow } from 'date-fns'

export default function ArtifactList() {
  const { artifacts, activeArtifact, setActiveArtifact } = useArtifact()

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
                primary={artifact.name}
                secondary={formatDistanceToNow(artifact.timestamp, { addSuffix: true })}
                primaryTypographyProps={{
                  sx: { 
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }
                }}
                secondaryTypographyProps={{
                  sx: {
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  )
} 