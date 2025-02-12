import { Box, Typography, FormControl, Select, MenuItem } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import DataViewer from './DataViewer'
import { useMemo, useEffect } from 'react'
import { hasData } from '../contexts/ArtifactContext.types'

interface DataFileInfo {
  step: string
  file: string
  lineNumbers: number[]
}

export default function ArtifactView() {
  const { activeArtifact, viewMode, selectedStep, setSelectedStep } = useArtifact()
  
  const dataFiles = useMemo<DataFileInfo[]>(() => {
    console.log('ArtifactView: Processing artifact:', activeArtifact)
    if (!activeArtifact) return []
    
    // Handle legacy case with single dataFile
    if (activeArtifact.dataFile && !activeArtifact.dataFiles) {
      console.log('ArtifactView: Using legacy dataFile')
      return [{
        step: 'data',
        file: activeArtifact.dataFile,
        lineNumbers: []
      }]
    }
    
    // Handle new case with multiple dataFiles
    if (activeArtifact.dataFiles) {
      console.log('ArtifactView: Using dataFiles:', activeArtifact.dataFiles)
      console.log('ArtifactView: Line numbers:', activeArtifact.lineNumbers)
      return Object.entries(activeArtifact.dataFiles)
        .map(([step, file]): DataFileInfo => {
          const lineNumbers = activeArtifact.lineNumbers[step] || []
          return {
            step,
            file,
            lineNumbers: Array.isArray(lineNumbers) ? lineNumbers : []
          }
        })
        .sort((a, b) => {
          // Now TypeScript knows these are definitely arrays
          const aLines = a.lineNumbers
          const bLines = b.lineNumbers
          const aFirst = aLines.length > 0 ? Math.min(...aLines) : Infinity
          const bFirst = bLines.length > 0 ? Math.min(...bLines) : Infinity
          return aFirst - bFirst
        })
    }
    
    console.log('ArtifactView: No data files found')
    return []
  }, [activeArtifact])

  // Log when selection changes
  useEffect(() => {
    console.log('ArtifactView: Selected step changed to:', selectedStep)
    console.log('ArtifactView: Available files:', dataFiles)
  }, [selectedStep, dataFiles])

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
      return hasData(activeArtifact) ? (
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
      ) : null

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