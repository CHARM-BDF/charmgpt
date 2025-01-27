import { Box, MenuItem, TextField } from '@mui/material'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

const sampleData = [
  { name: 'Jan', value: 400 },
  { name: 'Feb', value: 300 },
  { name: 'Mar', value: 600 },
  { name: 'Apr', value: 800 },
  { name: 'May', value: 700 }
]

export default function DataVisualizer() {
  return (
    <Box sx={{ height: '100%', p: 2 }}>
      <TextField
        select
        fullWidth
        label="Visualization Type"
        defaultValue="line"
        size="small"
        sx={{ mb: 2 }}
      >
        <MenuItem value="line">Line Chart</MenuItem>
        <MenuItem value="bar">Bar Chart</MenuItem>
        <MenuItem value="scatter">Scatter Plot</MenuItem>
      </TextField>
      
      <LineChart width={500} height={300} data={sampleData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke="#8884d8" />
      </LineChart>
    </Box>
  )
} 