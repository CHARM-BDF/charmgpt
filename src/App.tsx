import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { Grid } from '@mui/material'
import ChatInterface from './components/ChatInterface'
import CodeEditor from './components/CodeEditor'
import DataVisualizer from './components/DataVisualizer'
import ArtifactList from './components/ArtifactList'
import { useEffect } from 'react'
import { ArtifactProvider } from './contexts/ArtifactContext'
import { useArtifact } from './contexts/useArtifact'

const theme = createTheme({
  // You can customize your theme here
})

// Separate component for the main content
function MainContent() {
  const { artifacts } = useArtifact()

  return (
    <Box sx={{ 
      height: '100vh', 
      width: '100vw',
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
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
  )
}

export default function App() {
  useEffect(() => {
    document.title = 'CHARMGPT'
  }, [])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ArtifactProvider>
        <MainContent />
      </ArtifactProvider>
    </ThemeProvider>
  )
}
