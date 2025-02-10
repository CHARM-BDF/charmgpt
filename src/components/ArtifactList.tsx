import { useRef } from 'react'
import { Box, List, ListItem, ListItemButton, ListItemText, IconButton, ToggleButtonGroup, ToggleButton, Tooltip, Typography } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import UploadIcon from '@mui/icons-material/Upload'
import DownloadIcon from '@mui/icons-material/Download'
import { ViewMode, ArtifactType } from '../contexts/ArtifactContext.types'

interface UploadResponse {
  filepath: string
  filename: string
  mimetype: string
  size: number
  viewMode: ViewMode
}

export default function ArtifactList() {
  const { artifacts, addArtifact, activeArtifact, setActiveArtifact, viewMode, setViewMode } = useArtifact()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleViewModeChange = (_: React.MouseEvent<HTMLElement>, newMode: ViewMode) => {
    if (newMode !== null) {
      setViewMode(newMode)
    }
  }

  const handleDownload = async () => {
    if (!activeArtifact?.dataFile) return
    
    try {
      // Remove any API prefix if present
      const fullPath = activeArtifact.dataFile.startsWith('/api/data/') 
        ? activeArtifact.dataFile.substring('/api/data/'.length)
        : activeArtifact.dataFile

      // Get the original filename from the path
      const serverFilename = fullPath.split('/').pop()
      if (!serverFilename) {
        throw new Error('Invalid file path')
      }

      // Use a display name based on the artifact name or original filename
      const displayName = activeArtifact.name.endsWith('.csv')
        ? activeArtifact.name
        : serverFilename.replace(/^[^_]+_/, '') // Remove runId prefix

      const response = await fetch(`/api/data/${serverFilename}`)
      if (!response.ok) {
        throw new Error('Failed to download file')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = displayName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  const handleArtifactSelect = (artifact: typeof artifacts[0], viewMode?: ViewMode) => {
    setActiveArtifact(artifact)
    if (!viewMode) {
      if (artifact.plotFile) {
        viewMode = 'plot';
      } else if (artifact.dataFile?.endsWith('.csv')) {
        viewMode = 'data';
      } else {
        viewMode = 'output';
      }
   }
    setViewMode(viewMode)
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data: UploadResponse = await response.json()
      const now = Date.now()
      
      // Create new artifact with the uploaded file
      const newArtifact = {
        id: now,
        type: 'upload' as ArtifactType,
        name: data.filename,
        dataFile: data.filepath,
        output: `Uploaded file: ${data.filename}\nSize: ${data.size} bytes\nType: ${data.mimetype}`,
        timestamp: now
      }

      // Add artifact and immediately select it with the correct view mode
      addArtifact(newArtifact)
      handleArtifactSelect(newArtifact, data.viewMode)
    } catch (error) {
      console.error('Upload failed:', error)
    }

    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end' }}>
      <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          size="small"
        >
          {activeArtifact && activeArtifact.plotFile && (
            <ToggleButton value="plot">Plot</ToggleButton>
          )}
          {activeArtifact && activeArtifact.dataFile && (
            <ToggleButton value="data">Data</ToggleButton>
          )}
          {activeArtifact && activeArtifact.output && (
            <ToggleButton value="output">Output</ToggleButton>
          )}
         {activeArtifact && activeArtifact.dataFile && (
          <Tooltip title="Download data">
            <IconButton onClick={handleDownload} size="small">
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Upload file">
          <IconButton size="small" onClick={handleUploadClick}>
            <UploadIcon />
          </IconButton>
        </Tooltip>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleUpload}
          style={{ display: 'none' }}
        />
        </ToggleButtonGroup>
      </Box>
      
      {(artifacts.length == 0) ? (
        <Box sx={{ flex: 1, overflow: 'auto', p: 2}}>
        <Typography>(artifact list)</Typography>
      </Box>
      ) : (
      <List sx={{ flex: 1, overflow: 'auto' }}>
        {artifacts.map((artifact) => (
          <ListItem key={artifact.id} disablePadding>
            <ListItemButton 
              selected={activeArtifact?.id === artifact.id}
              onClick={() => handleArtifactSelect(artifact)}
            >
              <ListItemText 
                primary={artifact.name}
                secondary={new Date(artifact.timestamp).toLocaleString()}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      )}
    </Box>
  )
} 