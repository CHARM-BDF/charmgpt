import { Box, Paper, Typography } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import { Artifact } from '../contexts/ArtifactContext.types'
import { blue, purple } from '@mui/material/colors'

export default function ArtifactList() {
  const { artifacts, setActiveArtifact } = useArtifact()

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
      <Box sx={{ p: 0 }}>
        {artifacts.map((artifact: Artifact) => {
          const isChat = artifact.source === 'assistant'
          
          return (
            <Paper
              key={artifact.id}
              elevation={0}
              sx={{
                p: 2,
                mb: 2,
                cursor: 'pointer',
                backgroundColor: isChat ? purple[50] : blue[50],
                border: '2px solid',
                borderColor: isChat ? purple[200] : blue[200],
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateX(4px)',
                }
              }}
              onClick={() => setActiveArtifact(artifact)}
            >
              <Typography 
                variant="caption" 
                sx={{ 
                  display: 'block',
                  mb: 1,
                  color: isChat ? purple[700] : blue[700],
                }}
              >
                {artifact.timestamp.toLocaleTimeString()}
              </Typography>
              {artifact.output && (
                <Typography 
                  variant="body2" 
                  sx={{ 
                    whiteSpace: 'pre-wrap',
                    color: isChat ? purple[900] : blue[900],
                    p: 1,
                    borderRadius: 1,
                    fontSize: '0.8rem'
                  }}
                >
                  {artifact.output}
                </Typography>
              )}
            </Paper>
          )
        })}
      </Box>
    </Box>
  )
} 