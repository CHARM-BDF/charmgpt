import { Box, MenuItem, TextField, Typography, Paper } from '@mui/material'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useArtifact } from '../contexts/useArtifact'
import { API_BASE_URL, PLOT_PATH } from '../config'

const sampleData = [
  { name: 'Jan', value: 400 },
  { name: 'Feb', value: 300 },
  { name: 'Mar', value: 600 },
  { name: 'Apr', value: 800 },
  { name: 'May', value: 700 }
]

export default function DataVisualizer() {
  const { activeArtifact } = useArtifact()

  const getVisualizationData = () => {
    // First check if we have an active artifact
    if (!activeArtifact) return null
    
    // Then check if it's a visualization type
    if (activeArtifact.type !== 'visualization') return null

    // Finally try to parse the output
    try {
      return JSON.parse(activeArtifact.output)
    } catch (error) {
      console.warn('Failed to parse visualization data:', error)
      return null
    }
  }

  const plotData = getVisualizationData()

  return (
    <Box sx={{ height: '100%', p: 2, display: 'flex', flexDirection: 'column' }}>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>Results</Typography>
      <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
        {/* Left side: Visualization */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" gutterBottom>Visualization</Typography>
          {plotData ? (
            <LineChart width={400} height={250} data={plotData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#8884d8" />
            </LineChart>
          ) : (
            activeArtifact?.type === 'visualization' && (
              <Box 
                component="img"
                src={`${PLOT_PATH}/plot.png`}
                sx={{ 
                  maxWidth: '100%',
                  height: 'auto',
                  objectFit: 'contain'
                }}
              />
            )
          )}
        </Box>

        {/* Right side: Output */}
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