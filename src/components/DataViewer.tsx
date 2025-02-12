import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { Box, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import { useState, useEffect, useContext, useMemo } from 'react'
import { ArtifactContext } from '../contexts/ArtifactContext'

interface DataViewerProps {
  dataFile?: string
  height?: string | number
}

interface DataRow {
  id: string  // Change to string since we're using composite IDs
  _index?: number
  [key: string]: string | number | undefined
}


export function DataViewer({ dataFile, height }: DataViewerProps) {
  const { activeArtifact, selectedStep, setSelectedStep } = useContext(ArtifactContext)
  const [rows, setRows] = useState<DataRow[]>([])
  const [columns, setColumns] = useState<GridColDef[]>([])
  const [loading, setLoading] = useState(true)
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 25,
    page: 0,
  })

  // Get all variables sorted by line number - only for var2val artifacts
  const variables = useMemo(() => {
    if (!activeArtifact?.var2val) return []
    
    return Object.entries(activeArtifact.var2val)
      .map(([name, info]) => ({
        name,
        ...info,
        line_start: activeArtifact.var2line?.[name] || 0
      }))
      .sort((a, b) => a.line_start - b.line_start)
  }, [activeArtifact])

  useEffect(() => {
    const loadData = async () => {
      if (!dataFile) {
        setRows([])
        setColumns([])
        setLoading(false)
        return
      }
      
      try {
        setLoading(true)
        const response = await fetch(`/api/data/${dataFile}`)
        if (!response.ok) {
          throw new Error('Failed to load data')
        }

        const text = await response.text()
        const lines = text.split('\n').filter(line => line.trim())
        if (lines.length === 0) {
          setRows([])
          setColumns([])
          return
        }

        const headers = lines[0].split(',').map(h => h.trim())
        const cols = headers.map(header => ({
          field: header,
          headerName: header,
          flex: 1,
          sortable: true,
          filterable: true
        }))
        
        const data = lines.slice(1).map((line, index) => {
          const values = line.split(',').map(v => v.trim())
          // Create a unique ID using the dataFile and index
          const uniqueId = `${dataFile}_${index}`
          const row: DataRow = { 
            id: uniqueId,  // Use string ID instead of number
            _index: index  // Keep original index if needed
          }
          headers.forEach((header, i) => {
            const value = values[i]
            row[header] = isNaN(Number(value)) ? value : Number(value)
          })
          return row
        })
        
        setColumns(cols)
        setRows(data)
      } catch (error) {
        console.error('Failed to load data:', error)
        setRows([])
        setColumns([])
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [dataFile])

  const commonDataGridProps = {
    rows,
    columns,
    loading,
    density: "compact" as const,
    disableRowSelectionOnClick: true,
    pageSizeOptions: [10, 25, 50, 100],
    paginationModel,
    onPaginationModelChange: setPaginationModel,
    getRowId: (row: DataRow) => row.id,
    autoHeight: true,
    initialState: {
      pagination: {
        paginationModel: {
          pageSize: 25,
        },
      },
    },
  }

  return (
    <Box sx={{ height: height || '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Only show variables dropdown for var2val artifacts */}
      {activeArtifact?.var2val && variables.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, p: 1, borderBottom: 1, borderColor: 'divider' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Variables</InputLabel>
            <Select
              value={selectedStep || ''}
              onChange={(e) => setSelectedStep(e.target.value)}
              label="Variables"
            >
              {variables.map(({ name, type, line_start }) => (
                <MenuItem key={name} value={name}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>Line {line_start}:</span>
                    <span>{name}</span>
                    <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                      ({type})
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        {/* Show DataGrid for files, JSON view for immediate values */}
        {selectedStep && activeArtifact?.var2val?.[selectedStep]?.type === 'immediate' ? (
          <Box sx={{ p: 2, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
            {JSON.stringify(activeArtifact.var2val[selectedStep].value, null, 2)}
          </Box>
        ) : (
          <DataGrid {...commonDataGridProps} />
        )}
      </Box>
    </Box>
  )
} 