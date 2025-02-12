import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { Box } from '@mui/material'
import { useState, useEffect } from 'react'

interface DataViewerProps {
  dataFile?: string
  height?: string | number
}

interface DataRow {
  id: number
  [key: string]: string | number
}

export default function DataViewer({ dataFile, height = '100%' }: DataViewerProps) {
  const [rows, setRows] = useState<DataRow[]>([])
  const [columns, setColumns] = useState<GridColDef[]>([])
  const [loading, setLoading] = useState(true)
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 25,
    page: 0
  })

  console.log('DataViewer received dataFile:', dataFile)

  useEffect(() => {
    const loadData = async () => {
      if (!dataFile) return
      
      try {
        setLoading(true)
        const response = await fetch(`/api/data/${dataFile}`)
        if (!response.ok) {
          throw new Error('Failed to load data')
        }

        const text = await response.text()
        const lines = text.split('\n').filter(line => line.trim())
        if (lines.length === 0) return

        const headers = lines[0].split(',').map(h => h.trim())
        
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
          const values = line.split(',').map(v => v.trim())
          const row: DataRow = { id: index }
          headers.forEach((header, i) => {
            // Try to convert to number if possible
            const value = values[i]
            row[header] = isNaN(Number(value)) ? value : Number(value)
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
    <Box sx={{ height }}>
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        density="compact"
        disableRowSelectionOnClick
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[10, 25, 50, 100]}
        paginationMode="client"
        initialState={{
          pagination: {
            paginationModel: {
              pageSize: 25,
            },
          },
        }}
      />
    </Box>
  )
} 