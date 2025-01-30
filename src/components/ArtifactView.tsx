import { Box, Typography, Paper, ToggleButtonGroup, ToggleButton } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import { useState, useEffect } from 'react'

export default function ArtifactView() {
  const { activeArtifact, viewMode, setViewMode } = useArtifact()

  console.log('ArtifactView render:', {
    activeArtifact,
    plotFile: activeArtifact?.plotFile,
    dataFile: activeArtifact?.dataFile,
    viewMode
  })

  if (!activeArtifact) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">Select an artifact to view</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ 
        mb: 2, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2,
        backgroundColor: 'background.paper',
        zIndex: 1,
      }}>
        <Typography variant="h6">
          {activeArtifact.name}
        </Typography>
        <ToggleButtonGroup
          value={viewMode}
          onChange={(_, newMode) => newMode && setViewMode(newMode)}
          exclusive
          size="small"
        >
          <ToggleButton 
            value="plot" 
            disabled={!activeArtifact.plotFile}
          >
            Plot
          </ToggleButton>
          <ToggleButton 
            value="data" 
            disabled={!activeArtifact.dataFile}
          >
            Data
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Typography variant="caption" display="block" sx={{ mb: 1 }}>
        Mode: {viewMode}, Plot: {activeArtifact.plotFile ? 'Yes' : 'No'}, Data: {activeArtifact.dataFile ? 'Yes' : 'No'}
      </Typography>

      {activeArtifact.output && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.100' }}>
          <Typography component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
            {activeArtifact.output}
          </Typography>
        </Paper>
      )}

      {viewMode === 'plot' && activeArtifact.plotFile && (
        <Paper sx={{ p: 2 }}>
          <img 
            src={`/api/plots/${activeArtifact.plotFile}`}
            alt="Plot" 
            style={{ width: '100%', height: 'auto' }}
          />
        </Paper>
      )}

      {viewMode === 'data' && activeArtifact.dataFile && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ mb: 2 }}>
            <a 
              href={`/api/data/${activeArtifact.dataFile}`}
              download
              style={{ textDecoration: 'none' }}
            >
              Download CSV
            </a>
          </Box>
          <DataPreview dataFile={activeArtifact.dataFile} />
        </Paper>
      )}
    </Box>
  )
}

// Simple data preview component - we can enhance this later
function DataPreview({ dataFile }: { dataFile: string }) {
  const [data, setData] = useState<string[][]>([])

  useEffect(() => {
    fetch(`/api/data/${dataFile}`)
      .then(res => res.text())
      .then(text => {
        const rows = text.split('\n').map(row => row.split(','))
        setData(rows.slice(0, 10)) // Show first 10 rows
      })
      .catch(console.error)
  }, [dataFile])

  if (data.length === 0) {
    return <Typography>Loading data...</Typography>
  }

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {data[0].map((header, i) => (
              <th key={i} style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(1).map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
        Showing first {data.length - 1} rows of data
      </Typography>
    </Box>
  )
}