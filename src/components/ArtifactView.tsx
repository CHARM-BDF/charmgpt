import { useState, useEffect } from 'react'
import { Box, Paper, Typography, CircularProgress } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import Papa from 'papaparse'

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination
} from '@mui/material'

interface CSVData {
  headers: string[]
  rows: string[][]
}

export default function ArtifactView() {
  const { activeArtifact, viewMode } = useArtifact()
  const [csvData, setCSVData] = useState<CSVData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

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

  if (!activeArtifact) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography sx={{ fontStyle: 'italic', color: 'text.disabled' }}>
          (artifact view)
        </Typography>
      </Box>
    )
  }

  return (
       <Box sx={{ height: '100%', overflow: 'auto', p: 1 }}>
        {viewMode === 'plot' && activeArtifact.plotFile && (
          <Box sx={{ textAlign: 'center' }}>
            <img 
              src={`/api/data/${activeArtifact.plotFile.split('/').pop()}`} 
              alt="Plot"
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
  )
}