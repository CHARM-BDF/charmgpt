import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { Grid } from '@mui/material'
import ChatInterface from './components/ChatInterface'
import CodeEditor from './components/CodeEditor'
import DataVisualizer from './components/DataVisualizer'
import ArtifactList from './components/ArtifactList'
import { useState } from 'react'
import { Artifact } from './components/ArtifactList'

const theme = createTheme({
  // You can customize your theme here
})

function App() {
  const [artifacts] = useState<Artifact[]>([
    {
      id: 1,
      code: 'df.head()',
      output: 'DataFrame preview...',
      timestamp: new Date(),
      type: 'code'
    },
    {
      id: 2,
      code: 'plt.plot(df["column"])',
      output: 'Line chart visualization',
      timestamp: new Date(),
      type: 'visualization'
    }
  ])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ 
        height: '100vh', 
        width: '100vw',
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden' // Prevent scrollbars
      }}>
        <Grid container sx={{ flex: 1 }} spacing={1}>
          <Grid item xs={9}>
            <Grid container direction="column" spacing={1} sx={{ height: '100%' }}>
              <Grid item xs={6}>
                <Box sx={{ height: '100%', bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
                  <CodeEditor />
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ height: '100%', bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
                  <DataVisualizer />
                </Box>
              </Grid>
            </Grid>
          </Grid>
          <Grid item xs={3}>
            <Grid container direction="column" spacing={1} sx={{ height: '100%' }}>
              <Grid item xs={6}>
                <Box sx={{ height: '100%', bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
                  <ArtifactList artifacts={artifacts} />
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ height: '100%', bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
                  <ChatInterface />
                </Box>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Box>
    </ThemeProvider>
  )
}

export default App
