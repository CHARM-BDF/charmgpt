import { Box, Typography, FormControl, Select, MenuItem } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import DataViewer from './DataViewer'
import { useMemo, useEffect } from 'react'

export default function ArtifactView() {
  const { activeArtifact, viewMode, selectedStep, setSelectedStep } = useArtifact()
  
  // Get all data files for this artifact
  const dataFiles = useMemo(() => {
    if (!activeArtifact) return []
    
    // Handle legacy case with single dataFile
    if (activeArtifact.dataFile && !activeArtifact.dataFiles) {
      return [{
        step: 'data',
        file: activeArtifact.dataFile,
        lineNumber: 0
      }]
    }
    
    // Handle new case with multiple dataFiles
    if (activeArtifact.dataFiles) {
      return Object.entries(activeArtifact.dataFiles)
        .map(([step, file]) => ({ 
          step, 
          file,
          lineNumber: activeArtifact.lineNumbers[step]
        }))
        .sort((a, b) => a.lineNumber - b.lineNumber)
    }
    
    return []
  }, [activeArtifact])

  // Set initial selection to last data-producing step
  useEffect(() => {
    if (dataFiles.length > 0) {
      setSelectedStep(dataFiles[dataFiles.length - 1].step)
    }
  }, [dataFiles, setSelectedStep])

  if (!activeArtifact) {
    return (
      <Box sx={{ flex: 1, overflow: 'auto', p: 2}}>
        <Typography sx={{ height: '100%', p: 2, fontStyle: 'italic', color: 'text.disabled' }}>
          (artifact view)
        </Typography>
      </Box>
    )
  }

  switch (viewMode) {
    case 'plot':
      return activeArtifact.plotFile ? (
        <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <img src={activeArtifact.plotFile} alt="Plot" style={{ maxWidth: '100%', maxHeight: '100%' }} />
        </Box>
      ) : null

    case 'data':
      return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {dataFiles.length > 1 && (
            <FormControl size="small" sx={{ m: 1 }}>
              <Select
                value={selectedStep}
                onChange={(e) => setSelectedStep(e.target.value)}
              >
                {dataFiles.map(({ step }) => (
                  <MenuItem key={step} value={step}>{step}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          
          <DataViewer 
            dataFile={selectedStep ? 
              dataFiles.find(df => df.step === selectedStep)?.file : 
              dataFiles[0]?.file  // Fall back to first/only file
            } 
          />
        </Box>
      )

    case 'output':
      return (
        <Box sx={{ p: 2, whiteSpace: 'pre-wrap' }}>
          {activeArtifact.output}
        </Box>
      )

    default:
      return null
  }
}