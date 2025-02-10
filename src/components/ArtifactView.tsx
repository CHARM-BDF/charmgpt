import { Box, Typography } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import DataViewer from './DataViewer'

export default function ArtifactView() {
  const { activeArtifact, viewMode } = useArtifact()
  
  if (!activeArtifact) {
    return (
      <Box sx={{ flex: 1, overflow: 'auto', p: 2}}>
        <Typography sx={{ height: '100%', p: 2, fontStyle: 'italic', color: 'text.disabled' }}>
          (artifact view)
        </Typography>
      </Box>
    )
  }

  switch (viewMode) {
    case 'plot':
      return activeArtifact.plotFile ? (
        <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <img src={activeArtifact.plotFile} alt="Plot" style={{ maxWidth: '100%', maxHeight: '100%' }} />
        </Box>
      ) : null

    case 'data':
      return activeArtifact.dataFile ? (
        <Box sx={{ height: '100%', width: '100%' }}>
          <DataViewer dataFile={activeArtifact.dataFile} />
        </Box>
      ) : null

    case 'output':
      return (
        <Box sx={{ p: 2, whiteSpace: 'pre-wrap' }}>
          {activeArtifact.output}
        </Box>
      )

    default:
      return null
  }
}