import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { Container, Grid } from '@mui/material'
import ChatInterface from './components/ChatInterface'
import CodeEditor from './components/CodeEditor'
import DataVisualizer from './components/DataVisualizer'

const theme = createTheme({
  // You can customize your theme here
})

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Grid container sx={{ flex: 1 }} spacing={2} p={2}>
          <Grid item xs={8}>
            <Grid container direction="column" spacing={2} sx={{ height: '100%' }}>
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
          <Grid item xs={4}>
            <Box sx={{ height: '100%', bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
              <ChatInterface />
            </Box>
          </Grid>
        </Grid>
      </Box>
    </ThemeProvider>
  )
}

export default App
