import { Box, Paper, Typography } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import { Artifact } from '../contexts/ArtifactContext.types'
import { grey, purple } from '@mui/material/colors'
import PersonIcon from '@mui/icons-material/Person'
import SmartToyIcon from '@mui/icons-material/SmartToy'

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
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                mb: 1,
                gap: 1
              }}>
                {isChat ? (
                  <SmartToyIcon sx={{ color: purple[400] }} />
                ) : (
                  <PersonIcon sx={{ color: grey[600] }} />
                )}
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    color: isChat ? purple[700] : grey[700],
                    fontWeight: isChat ? 500 : 400
                  }}
                >
                  {artifact.name}
                </Typography>
              </Box>
              <Typography 
                variant="body2" 
                sx={{ 
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  backgroundColor: isChat ? purple[100] : grey[100],
                  p: 1,
                  borderRadius: 1,
                  mb: 1,
                  maxHeight: '150px',
                  overflow: 'auto',
                  fontSize: '0.8rem'
                }}
              >
                {artifact.code}
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