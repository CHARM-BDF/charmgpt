import { Box, Typography, IconButton } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import { DataViewer } from './DataViewer'
import { useMemo, useEffect, useState } from 'react'
import { hasData, ImmediateValue, FileValue } from '../contexts/ArtifactContext.types'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

interface VarInfo {
  name: string
  type: ImmediateValue['type'] | FileValue['type']
  value: ImmediateValue['value'] | FileValue['value']
  line_start: number
}

export default function ArtifactView() {
  const { activeArtifact, viewMode, selectedStep, setSelectedStep } = useArtifact()
  const [currentPlotIndex, setCurrentPlotIndex] = useState(0)
  
  const variables = useMemo<VarInfo[]>(() => {
    if (!activeArtifact?.var2val) return []
    
    // Handle uploads
    if (activeArtifact.dataFile && !Object.keys(activeArtifact.var2val).length) {
      return [{
        name: 'data',
        type: 'file',
        value: activeArtifact.dataFile,
        line_start: 0
      }]
    }
    
    // Handle variables with their values
    return Object.entries(activeArtifact.var2val || {})
      .map(([name, info]): VarInfo => ({
        name,
        ...info,
        line_start: activeArtifact.var2line?.[name] || 0
      }))
      .sort((a, b) => a.line_start - b.line_start)
  }, [activeArtifact])

  // Reset plot index when active artifact changes
  useEffect(() => {
    setCurrentPlotIndex(0)
  }, [activeArtifact?.id])

  // Set initial selection to last variable
  useEffect(() => {
    if (activeArtifact?.dataFile && !Object.keys(activeArtifact.var2val || {}).length) {
      setSelectedStep('data')  // For uploads
    } else if (variables.length > 0) {
      setSelectedStep(variables[variables.length - 1].name)
    }
  }, [activeArtifact, variables, setSelectedStep])

  if (!activeArtifact) {
    return (
      <Box sx={{ flex: 1, overflow: 'auto', p: 2}}>
        <Typography sx={{ height: '100%', p: 2, fontStyle: 'italic', color: 'text.disabled' }}>
          (artifact view)
        </Typography>
      </Box>
    )
  }

  // Get all available plot files
  const plotFiles = activeArtifact.plotFiles || 
    (activeArtifact.plotFile ? [activeArtifact.plotFile] : []);
  
  // Get the current plot file to display
  const currentPlotFile = plotFiles.length > 0 ? 
    plotFiles[Math.min(currentPlotIndex, plotFiles.length - 1)] : 
    undefined;
  
  // Handle navigation between plots
  const handlePrevPlot = () => {
    setCurrentPlotIndex(prev => Math.max(0, prev - 1));
  };
  
  const handleNextPlot = () => {
    setCurrentPlotIndex(prev => Math.min(plotFiles.length - 1, prev + 1));
  };

  switch (viewMode) {
    case 'plot': {
      return currentPlotFile ? (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {plotFiles.length > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 1 }}>
              <IconButton 
                onClick={handlePrevPlot} 
                disabled={currentPlotIndex === 0}
                size="small"
              >
                <ChevronLeftIcon />
              </IconButton>
              <Typography sx={{ mx: 2 }}>
                Plot {currentPlotIndex + 1} of {plotFiles.length}
              </Typography>
              <IconButton 
                onClick={handleNextPlot} 
                disabled={currentPlotIndex === plotFiles.length - 1}
                size="small"
              >
                <ChevronRightIcon />
              </IconButton>
            </Box>
          )}
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img src={currentPlotFile} alt={`Plot ${currentPlotIndex + 1}`} style={{ maxWidth: '100%', maxHeight: '100%' }} />
          </Box>
        </Box>
      ) : null
    }

    case 'data': {
      const canShowData = hasData(activeArtifact)
      console.log('Can show data:', canShowData, 'activeArtifact:', activeArtifact)
      return canShowData ? (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <DataViewer 
            dataFile={
              activeArtifact.dataFile || // Handle uploads first
              (selectedStep && activeArtifact.var2val?.[selectedStep]?.type === 'file' 
                ? activeArtifact.var2val?.[selectedStep]?.value 
                : undefined)
            } 
          />
        </Box>
      ) : null
    }

    case 'output': {
      return (
        <Box sx={{ p: 2, whiteSpace: 'pre-wrap' }}>
          {activeArtifact.output}
        </Box>
      )
    }

    default:
      return null
  }
}