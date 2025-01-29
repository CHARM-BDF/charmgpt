import { Box, Paper } from '@mui/material'
import { useEffect, useState } from 'react'
import { useArtifact } from '../contexts/useArtifact'

interface DataVisualizerProps {
  plotFile?: string
}

export default function DataVisualizer({ plotFile: propPlotFile }: DataVisualizerProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const { activeArtifact } = useArtifact()
  
  const plotFile = propPlotFile || activeArtifact?.plotFile

  useEffect(() => {
    console.log('Plot file changed:', plotFile)
    let mounted = true
    let retryCount = 0
    const maxRetries = 3

    const loadPlot = async () => {
      if (!plotFile) {
        console.log('No plot file, clearing image')
        setImageSrc(null)
        return
      }

      const tryLoadPlot = async () => {
        try {
          // Check if the plot exists
          const response = await fetch(`/api/plots/${plotFile}`)
          if (!response.ok) {
            console.log(`Plot not ready (attempt ${retryCount + 1}), status: ${response.status}`)
            if (retryCount < maxRetries) {
              retryCount++
              // Wait a bit longer between each retry
              await new Promise(resolve => setTimeout(resolve, 500 * retryCount))
              return tryLoadPlot()
            }
            throw new Error(`Failed to load plot after ${maxRetries} attempts`)
          }

          // Plot exists, set the image source
          const newSrc = `/api/plots/${plotFile}?t=${Date.now()}`
          console.log('Setting new image source:', newSrc)
          if (mounted) {
            setImageSrc(newSrc)
          }
        } catch (error) {
          console.error('Error loading plot:', error)
          if (mounted) setImageSrc(null)
        }
      }

      // Add initial delay to ensure plot is ready
      await new Promise(resolve => setTimeout(resolve, 200))
      await tryLoadPlot()
    }

    loadPlot()

    return () => {
      console.log('Cleaning up plot:', plotFile)
      mounted = false
    }
  }, [plotFile])

  console.log('Rendering with imageSrc:', imageSrc)

  return (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'row',
      gap: 2,
      p: 2,
      height: '100%',
      width: '100%',
      overflow: 'hidden'
    }}>
      <Box sx={{ 
        flex: '1 1 60%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: imageSrc ? 'none' : '1px dashed #ccc',
        borderRadius: 1,
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {imageSrc ? (
          <Box
            component="img"
            src={imageSrc}
            alt="Data visualization"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain'
            }}
            onError={(e) => {
              console.error('Image load error for:', imageSrc)
              setImageSrc(null)
            }}
          />
        ) : plotFile ? (
          <Box sx={{ p: 2, color: '#666' }}>Loading plot...</Box>
        ) : null}
      </Box>
      <Box sx={{ 
        flex: '1 1 40%',
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {activeArtifact?.output && (
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2,
              height: '100%',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              whiteSpace: 'pre-wrap',
              overflow: 'auto'
            }}
          >
            {activeArtifact.output}
          </Paper>
        )}
      </Box>
    </Box>
  )
} 