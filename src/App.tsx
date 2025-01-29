import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { Grid } from '@mui/material'
import ChatInterface from './components/ChatInterface'
import CodeEditor from './components/CodeEditor'
import DataVisualizer from './components/DataVisualizer'
import ArtifactList from './components/ArtifactList'
import { useEffect } from 'react'
import { ArtifactProvider } from './contexts/ArtifactContext'

const theme = createTheme({
  // You can customize your theme here
})

function AppContent() {
  const handleKeyDown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      // We'll handle the run action in the individual components
      const customEvent = new CustomEvent('run-artifact')
      window.dispatchEvent(customEvent)
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <Box sx={{ 
      height: '100vh', 
      width: '100vw',
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <Grid container sx={{ flex: 1, height: '100%' }} spacing={1}>
        <Grid item xs={9} sx={{ height: '100%' }}>
          <Grid container direction="column" spacing={1} sx={{ height: '100%' }}>
            <Grid item xs={6} sx={{ minHeight: 0 }}>
              <Box sx={{ 
                height: '100%', 
                bgcolor: 'background.paper', 
                borderRadius: 1, 
                boxShadow: 1,
                overflow: 'hidden'
              }}>
                <CodeEditor />
              </Box>
            </Grid>
            <Grid item xs={6} sx={{ minHeight: 0 }}>
              <Box sx={{ 
                height: '100%', 
                bgcolor: 'background.paper', 
                borderRadius: 1, 
                boxShadow: 1,
                overflow: 'hidden'
              }}>
                <DataVisualizer />
              </Box>
            </Grid>
          </Grid>
        </Grid>
        <Grid item xs={3} sx={{ height: '100%' }}>
          <Grid container direction="column" spacing={1} sx={{ height: '100%' }}>
            <Grid item xs={6} sx={{ minHeight: 0 }}>
              <Box sx={{ 
                height: '100%', 
                bgcolor: 'background.paper', 
                borderRadius: 1, 
                boxShadow: 1,
                overflow: 'hidden'
              }}>
                <ArtifactList />
              </Box>
            </Grid>
            <Grid item xs={6} sx={{ minHeight: 0 }}>
              <Box sx={{ 
                height: '100%', 
                bgcolor: 'background.paper', 
                borderRadius: 1, 
                boxShadow: 1,
                overflow: 'hidden'
              }}>
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
    <ArtifactProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppContent />
      </ThemeProvider>
    </ArtifactProvider>
  )
}
