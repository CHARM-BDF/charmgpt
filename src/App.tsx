import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import ChatInterface from './components/ChatInterface'
import CodeEditor from './components/CodeEditor'
//import DataVisualizer from './components/DataVisualizer'
import ArtifactList from './components/ArtifactList'
import ArtifactView from './components/ArtifactView'
import { useEffect, useCallback, useRef } from 'react'
import { ArtifactProvider } from './contexts/ArtifactContext'
import { useArtifact } from './contexts/useArtifact'
import { Panel, PanelGroup, PanelResizeHandle, ImperativePanelHandle } from 'react-resizable-panels'
import { ChatProvider } from './contexts/ChatContext'

const theme = createTheme({
  // You can customize your theme here
})

const ResizeHandle = () => (
  <PanelResizeHandle 
    style={{
      width: '4px',
      background: 'var(--mui-palette-divider)',
      margin: '0',
      cursor: 'col-resize',
    }}
  />
)

const VerticalResizeHandle = () => (
  <PanelResizeHandle 
    style={{
      height: '4px',
      background: 'var(--mui-palette-divider)',
      margin: '0',
      cursor: 'row-resize',
    }}
  />
)

function AppContent() {
  const { runArtifact, editorContent } = useArtifact()
  const mainPanelRef = useRef<ImperativePanelHandle>(null)
  const editorPanelRef = useRef<ImperativePanelHandle>(null)
  const rightPanelRef = useRef<ImperativePanelHandle>(null)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      runArtifact(editorContent)
    }
  }, [runArtifact, editorContent])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    const handleResize = () => {
      mainPanelRef.current?.resize(80)
      editorPanelRef.current?.resize(65)
      rightPanelRef.current?.resize(50)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <Box sx={{ 
      height: '100vh', 
      display: 'flex', 
      overflow: 'hidden',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    }}>
      <PanelGroup direction="horizontal" style={{ width: '100%' }}>
        <Panel 
          defaultSize={80} 
          minSize={70} 
          maxSize={85} 
          ref={mainPanelRef}
          style={{ display: 'flex' }}
        >
          <PanelGroup direction="vertical" style={{ height: '100%', width: '100%' }}>
            <Panel 
              defaultSize={65} 
              minSize={50} 
              maxSize={75} 
              ref={editorPanelRef}
              style={{ display: 'flex' }}
            >
              <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
                <CodeEditor />
              </Box>
            </Panel>
            
            <VerticalResizeHandle />
            
            <Panel minSize={25} maxSize={50} style={{ display: 'flex' }}>
              <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
                <ArtifactView />
              </Box>
            </Panel>
          </PanelGroup>
        </Panel>
        
        <ResizeHandle />
        
        <Panel 
          defaultSize={20} 
          minSize={15} 
          maxSize={30}
          style={{ display: 'flex' }}
        >
          <PanelGroup direction="vertical" style={{ height: '100%', width: '100%' }}>
            <Panel 
              defaultSize={50} 
              minSize={30} 
              maxSize={70} 
              ref={rightPanelRef}
              style={{ display: 'flex' }}
            >
              <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
                <ArtifactList />
              </Box>
            </Panel>
            
            <VerticalResizeHandle />
            
            <Panel minSize={30} maxSize={70} style={{ display: 'flex' }}>
              <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
                <ChatInterface />
              </Box>
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </Box>
  )
}

export default function App() {
  useEffect(() => {
    document.title = 'CHARMGPT'
  }, [])

  return (
    <ChatProvider>
      <ArtifactProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AppContent />
        </ThemeProvider>
      </ArtifactProvider>
    </ChatProvider>
  )
}
