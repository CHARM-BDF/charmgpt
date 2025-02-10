import { Box, Typography } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import { useState, useEffect } from 'react'
import { ToggleButtonGroup, ToggleButton } from '@mui/material'

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

  const handleViewChange = (
    event: React.MouseEvent<HTMLElement>,
    newMode: string | null
  ) => {
    if (newMode) {
      setViewMode(newMode as 'plot' | 'data' | 'output')
    }
  }

  if (!activeArtifact) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">Select an artifact to view</Typography>
      </Box>
    )
  }

  const renderContent = () => {
    switch (viewMode) {
      case 'plot':
        return activeArtifact.plotFile ? (
          <Box 
            component="img" 
            src={activeArtifact.plotFile}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              maxWidth: '100%',
              maxHeight: '100%'
            }}
          />
        ) : null

      case 'data':
        return activeArtifact.dataFile ? (
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
        ) : null

      case 'output':
        return (
          <Box sx={{ 
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            overflow: 'auto'
          }}>
            {activeArtifact.output}
          </Box>
        )

      default:
        return null
    }
  }

  return (
    <Box 
      sx={{ 
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewChange}
          size="small"
        >
          {activeArtifact.plotFile && (
            <ToggleButton value="plot">Plot</ToggleButton>
          )}
          {activeArtifact.dataFile && (
            <ToggleButton value="data">Data</ToggleButton>
          )}
          {activeArtifact.output && (
            <ToggleButton value="output">Output</ToggleButton>
          )}
        </ToggleButtonGroup>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {renderContent()}
      </Box>
    </Box>
  )
}