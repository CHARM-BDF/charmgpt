import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { Box } from '@mui/material'
import { useState, useEffect } from 'react'

interface DataViewerProps {
  dataFile?: string
}

interface DataRow {
  id: number
  [key: string]: string | number  // Allow any string key with string or number value
}

export default function DataViewer({ dataFile }: DataViewerProps) {
  const [rows, setRows] = useState<DataRow[]>([])
  const [columns, setColumns] = useState<GridColDef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (!dataFile) return
      
      try {
        setLoading(true)
        const response = await fetch(`/api/data/${dataFile}`)
        const text = await response.text()
        
        // Parse CSV
        const lines = text.split('\n').filter(line => line.trim())
        const headers = lines[0].split(',')
        
        // Create column definitions
        const cols = headers.map(header => ({
          field: header,
          headerName: header,
          flex: 1,
          sortable: true,
          filterable: true
        }))
        
        // Parse data rows
        const data = lines.slice(1).map((line, index) => {
          const values = line.split(',')
          const row: DataRow = { id: index }
          headers.forEach((header, i) => {
            row[header] = values[i]
          })
          return row
        })
        
        setColumns(cols)
        setRows(data)
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [dataFile])

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        density="compact"
        disableRowSelectionOnClick
        initialState={{
          pagination: { paginationModel: { pageSize: 100 } },
        }}
        pageSizeOptions={[25, 50, 100]}
      />
    </Box>
  )
} 