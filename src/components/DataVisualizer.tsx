import { Box, Paper } from '@mui/material'
import { useEffect, useState } from 'react'
import { useArtifact } from '../contexts/useArtifact'
import { API_BASE_URL } from '../config'

interface DataVisualizerProps {
  plotFile?: string
}

export default function DataVisualizer({ plotFile: propPlotFile }: DataVisualizerProps) {
  const { activeArtifact } = useArtifact()
  const [imageSrc, setImageSrc] = useState<string | null>(null)

  const plotFile = propPlotFile || activeArtifact?.plotFile

  useEffect(() => {
    console.log('Plot file changed:', plotFile)

    if (plotFile) {
      if (plotFile.startsWith('http')) {
        setImageSrc(plotFile)
      } else {
        setImageSrc(`${API_BASE_URL}/plots/${plotFile}`)
      }
    } else {
      setImageSrc(null)
    }

    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc)
      }
    }
  }, [plotFile, imageSrc, API_BASE_URL])

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
              void e;
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