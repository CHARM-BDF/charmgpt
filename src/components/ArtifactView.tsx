import { useState, useEffect } from 'react'
import { Box, Paper, Typography, CircularProgress, ToggleButtonGroup, ToggleButton, IconButton, Tooltip } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import Papa from 'papaparse'
import { ViewMode } from '../contexts/ArtifactContext.types'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'

interface CSVData {
  headers: string[]
  rows: string[][]
}

export default function ArtifactView() {
  const { activeArtifact, viewMode, setViewMode } = useArtifact()
  const [csvData, setCSVData] = useState<CSVData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const handleViewModeChange = (_: React.MouseEvent<HTMLElement>, newMode: ViewMode) => {
    if (newMode !== null) {
      setViewMode(newMode)
    }
  }

  useEffect(() => {
    if (!activeArtifact?.dataFile?.endsWith('.csv')) {
      setCSVData(null)
      return
    }

    const dataFile = activeArtifact.dataFile
    const loadCSV = async () => {
      setLoading(true)
      setError(null)
      try {
        const filename = dataFile.split('/').pop()
        if (!filename) {
          throw new Error('Invalid file path')
        }
        
        const response = await fetch(`/api/data/${filename}`)
        if (!response.ok) {
          throw new Error('Failed to load CSV file')
        }
        
        const text = await response.text()
        Papa.parse(text, {
          header: false,
          complete: (result) => {
            if (result.data.length > 0) {
              setCSVData({
                headers: result.data[0] as string[],
                rows: result.data.slice(1) as string[][]
              })
            }
          },
          error: (error: Error) => {
            setError(`Failed to parse CSV: ${error.message}`)
          }
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load CSV file')
      } finally {
        setLoading(false)
      }
    }

    loadCSV()
  }, [activeArtifact])

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleDownload = async () => {
    if (!activeArtifact?.dataFile) return
    
    try {
      const filename = activeArtifact.dataFile.split('/').pop()
      if (!filename) {
        throw new Error('Invalid file path')
      }

      const response = await fetch(`/api/data/${filename}`)
      if (!response.ok) {
        throw new Error('Failed to download file')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  if (!activeArtifact) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Select an artifact to view</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          size="small"
        >
          {activeArtifact.plotFile && (
            <ToggleButton value="plot">Plot</ToggleButton>
          )}
          {activeArtifact.dataFile && (
            <ToggleButton value="data">Data</ToggleButton>
          )}
          <ToggleButton value="output">Output</ToggleButton>
        </ToggleButtonGroup>

        {activeArtifact.dataFile && (
          <Tooltip title="Download data">
            <IconButton onClick={handleDownload} size="small">
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {viewMode === 'plot' && activeArtifact.plotFile && (
          <Box sx={{ textAlign: 'center' }}>
            <img 
              src={`/api/data/${activeArtifact.plotFile.split('/').pop()}`} 
              alt="Plot" 
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </Box>
        )}

        {viewMode === 'data' && activeArtifact.dataFile?.endsWith('.csv') && (
          <>
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress />
              </Box>
            )}
            {error && (
              <Typography color="error">{error}</Typography>
            )}
            {csvData && csvData.rows.length > 0 && (
              <>
                <TableContainer component={Paper} sx={{ maxHeight: '100%' }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        {csvData.headers.map((header, index) => (
                          <TableCell key={index}>{header}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {csvData.rows
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                              <TableCell key={cellIndex}>{cell}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  component="div"
                  count={csvData.rows.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                />
              </>
            )}
          </>
        )}

        {viewMode === 'output' && (
          <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
            {activeArtifact.output}
          </Typography>
        )}
      </Box>
    </Box>
  )
}