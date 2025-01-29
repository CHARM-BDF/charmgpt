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
      <Typography variant="h6" sx={{ mb: 2 }}>History</Typography>
      <Box sx={{ p: 0 }}>
        {artifacts.map((artifact: Artifact) => {
          const isActive = activeArtifact?.id === artifact.id
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
                transition: 'border-color 0.2s ease',
                '&:hover': {
                  borderColor: artifact.source === 'chat' ? purple[200] : grey[300],
                }
              }}
              onClick={() => setActiveArtifact(artifact)}
            >
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  color: artifact.source === 'chat' ? purple[700] : grey[700],
                  mb: 1 
                }}
              >
                {artifact.name}
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  backgroundColor: grey[100],
                  p: 1,
                  borderRadius: 1,
                  mb: 1,
                  maxHeight: '150px',
                  overflow: 'auto'
                }}
              >
                {artifact.code}
              </Typography>
              {artifact.output && (
                <Typography 
                  variant="body2" 
                  sx={{ 
                    whiteSpace: 'pre-wrap',
                    color: artifact.source === 'chat' ? purple[900] : grey[900],
                    backgroundColor: grey[50],
                    p: 1,
                    borderRadius: 1,
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