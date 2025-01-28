import { Box, Typography, Paper } from '@mui/material'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useArtifact } from '../contexts/useArtifact'
import { useEffect } from 'react'
import { API_BASE_URL, PLOT_PATH } from '../config/index'

export default function DataVisualizer() {
  const { activeArtifact } = useArtifact()
  
  console.log('Active artifact:', activeArtifact)

  // Cleanup plot files when component unmounts or artifact changes
  useEffect(() => {
    return () => {
      if (activeArtifact?.plotFile) {
        fetch(`${API_BASE_URL}/plots/${activeArtifact.plotFile}`, {
          method: 'DELETE'
        }).catch(console.error)
      }
    }
  }, [activeArtifact?.plotFile])

  useEffect(() => {
    if (activeArtifact?.plotFile) {
      const plotUrl = `${PLOT_PATH}/${activeArtifact.plotFile}`
      console.log('Plot URL:', plotUrl)
      
      // Test if the image is accessible
      fetch(plotUrl)
        .then(response => {
          console.log('Plot fetch response:', response.status, response.statusText)
        })
        .catch(error => {
          console.error('Plot fetch error:', error)
        })
    }
  }, [activeArtifact?.plotFile])

  return (
    <Box sx={{ height: '100%', p: 2, display: 'flex', flexDirection: 'column' }}>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>Results</Typography>
      <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" gutterBottom>Visualization</Typography>
          {activeArtifact?.plotFile && (
            <>
              <Box 
                component="img"
                src={`${PLOT_PATH}/${activeArtifact.plotFile}`}
                sx={{ 
                  maxWidth: '100%',
                  height: 'auto',
                  objectFit: 'contain'
                }}
                onError={(e) => {
                  console.error('Image load error:', e)
                }}
                onLoad={() => {
                  console.log('Image loaded successfully')
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Plot file: {activeArtifact.plotFile}
              </Typography>
            </>
          )}
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" gutterBottom>Output</Typography>
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              height: '300px', 
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              whiteSpace: 'pre-wrap'
            }}
          >
            {activeArtifact?.output || 'No output'}
          </Paper>
        </Box>
      </Box>
    </Box>
  )
} 