import { Box, Typography, FormControl, Select, MenuItem } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import { DataViewer } from './DataViewer'
import { useMemo, useEffect } from 'react'
import { hasData, ImmediateValue, FileValue } from '../contexts/ArtifactContext.types'

interface VarInfo {
  name: string
  type: ImmediateValue['type'] | FileValue['type']
  value: ImmediateValue['value'] | FileValue['value']
  line_start: number
}

export default function ArtifactView() {
  const { activeArtifact, viewMode, selectedStep, setSelectedStep } = useArtifact()
  
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

  switch (viewMode) {
    case 'plot': {
      return activeArtifact.plotFile ? (
        <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <img src={activeArtifact.plotFile} alt="Plot" style={{ maxWidth: '100%', maxHeight: '100%' }} />
        </Box>
      ) : null
    }

    case 'data': {
      const canShowData = hasData(activeArtifact)
      console.log('Can show data:', canShowData, 'activeArtifact:', activeArtifact)
      return canShowData ? (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {variables.length > 0 && (
            <FormControl size="small" sx={{ m: 1 }}>
              <Select
                value={selectedStep || ''}
                onChange={(e) => setSelectedStep(e.target.value)}
              >
                {variables.map(({ name, type, line_start }) => (
                  <MenuItem key={name} value={name}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>Line {line_start}:</span>
                      <span>{name}</span>
                      <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                        ({type})
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          
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