import { Box, Paper, Typography } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import { Artifact } from '../contexts/ArtifactContext.types'
import { grey, purple } from '@mui/material/colors'

export default function ArtifactList() {
  const { artifacts, activeArtifact, setActiveArtifact } = useArtifact()

  const getArtifactColor = (source: 'user' | 'chat') => {
    return source === 'chat' ? purple[50] : grey[50]
  }

  const getBorderColor = (artifact: Artifact, isActive: boolean) => {
    if (isActive) {
      return artifact.source === 'chat' ? purple[300] : grey[400]
    }
    return artifact.source === 'chat' ? purple[100] : grey[200]
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
      <Box sx={{ p: 0 }}>
        {artifacts.map((artifact: Artifact) => {
          const isActive = activeArtifact?.id === artifact.id
          const isChat = artifact.source === 'chat'
          return (
            <Paper
              key={artifact.id}
              sx={{
                p: 2,
                mb: 2,
                cursor: 'pointer',
                backgroundColor: getArtifactColor(artifact.source),
                border: '1px solid',
                borderColor: getBorderColor(artifact, isActive),
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: isChat ? purple[200] : grey[300],
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
                  color: isChat ? purple[700] : grey[700],
                }}
              >
                {new Date(artifact.timestamp).toLocaleTimeString()}
              </Typography>
              {artifact.output && (
                <Typography 
                  variant="body2" 
                  sx={{ 
                    whiteSpace: 'pre-wrap',
                    color: isChat ? purple[900] : grey[900],
                    backgroundColor: isChat ? purple[50] : grey[50],
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