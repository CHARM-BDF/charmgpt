import { useRef } from 'react'
import { Box, List, ListItem, ListItemButton, ListItemText, IconButton, Tooltip } from '@mui/material'
import { useArtifact } from '../contexts/useArtifact'
import UploadIcon from '@mui/icons-material/Upload'
import { ViewMode, ArtifactType } from '../contexts/ArtifactContext.types'

interface UploadResponse {
  filepath: string
  filename: string
  mimetype: string
  size: number
  viewMode: ViewMode
}

export default function ArtifactList() {
  const { artifacts, addArtifact, activeArtifact, setActiveArtifact, setViewMode } = useArtifact()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleArtifactSelect = (artifact: typeof artifacts[0], viewMode: ViewMode) => {
    setActiveArtifact(artifact)
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
      </Box>
      
      <List sx={{ flex: 1, overflow: 'auto' }}>
        {artifacts.map((artifact) => (
          <ListItem key={artifact.id} disablePadding>
            <ListItemButton 
              selected={activeArtifact?.id === artifact.id}
              onClick={() => handleArtifactSelect(artifact, artifact.dataFile?.endsWith('.csv') ? 'data' : 'output')}
            >
              <ListItemText 
                primary={artifact.name}
                secondary={new Date(artifact.timestamp).toLocaleString()}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  )
} 