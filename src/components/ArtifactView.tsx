import { Box, Paper, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import { useState, useEffect } from 'react'

interface DataPreviewProps {
  dataFile: string
}

function DataPreview({ dataFile }: DataPreviewProps) {
  const [data, setData] = useState<string[][]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching data from:', dataFile)
        const response = await fetch(`/api/data/${dataFile}`)
        const text = await response.text()
        console.log('Received data:', text.slice(0, 100) + '...') // Log first 100 chars
        
        // Parse CSV
        const rows = text.split('\n').map(line => line.split(','))
        setData(rows)
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    if (dataFile) {
      fetchData()
    }
  }, [dataFile])

  if (!data.length) {
    return <div>Loading data...</div>
  }

  // Display as a table with headers
  const [headers, ...rows] = data

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {headers.map((header, i) => (
              <th key={i} style={{ 
                padding: '8px', 
                borderBottom: '2px solid #ddd',
                textAlign: 'left',
                backgroundColor: '#f5f5f5'
              }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((row, i) => (  // Show first 100 rows
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={{ 
                  padding: '8px', 
                  borderBottom: '1px solid #eee',
                  whiteSpace: 'nowrap'
                }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 100 && (
        <Typography variant="caption" sx={{ mt: 2, display: 'block' }}>
          Showing first 100 rows of {rows.length} total rows
        </Typography>
      )}
    </Box>
  )
}

export default function ArtifactView() {
  const { activeArtifact, viewMode, setViewMode } = useArtifact()

  console.log('ArtifactView render:', { 
    viewMode, 
    hasPlot: activeArtifact?.plotFile,
    hasData: activeArtifact?.dataFile 
  })

  if (!activeArtifact) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">Select an artifact to view</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ 
      p: 2,
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header with reduced bottom margin */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: 2,
        mb: 1  // Reduced from mb: 2 to mb: 1
      }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {activeArtifact.name}
        </Typography>
        
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, newMode) => newMode && setViewMode(newMode)}
          size="small"
        >
          <ToggleButton 
            value="plot" 
            aria-label="plot view"
            disabled={!activeArtifact.plotFile}
          >
            Plot
          </ToggleButton>
          <ToggleButton 
            value="data" 
            aria-label="data view"
            disabled={!activeArtifact.dataFile}
          >
            Data
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Content Area with reduced top padding */}
      <Paper sx={{ 
        pt: 1,  // Reduced from p: 2 to pt: 1 for top padding
        px: 2,  // Keep horizontal padding
        pb: 2,  // Keep bottom padding
        flexGrow: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          {viewMode === 'plot' && activeArtifact.plotFile && (
            <img 
              src={`/api/plots/${activeArtifact.plotFile}`}
              alt="Plot" 
              style={{ width: '100%', height: 'auto' }}
            />
          )}
          
          {viewMode === 'data' && activeArtifact.dataFile && (
            <Box>
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
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  )
}