import { Box, List, ListItem, Typography, Divider } from '@mui/material'
import CodeIcon from '@mui/icons-material/Code'
import BarChartIcon from '@mui/icons-material/BarChart'

export interface Artifact {
  id: number
  code: string
  output: string
  timestamp: Date
  type: 'visualization' | 'code'
}

interface ArtifactListProps {
  artifacts: Artifact[]
}

export default function ArtifactList({ artifacts }: ArtifactListProps) {
  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
        Artifacts
      </Typography>
      <List sx={{ p: 0 }}>
        {artifacts.map((artifact) => (
          <ListItem 
            key={artifact.id}
            sx={{ 
              mb: 1, 
              bgcolor: 'grey.50',
              borderRadius: 1,
              flexDirection: 'column',
              alignItems: 'flex-start'
            }}
          >
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              width: '100%',
              mb: 1
            }}>
              {artifact.type === 'code' ? <CodeIcon sx={{ mr: 1 }} /> : <BarChartIcon sx={{ mr: 1 }} />}
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {artifact.timestamp.toLocaleTimeString()}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
              {artifact.code}
            </Typography>
            <Divider sx={{ width: '100%', my: 1 }} />
            <Typography variant="body2">
              {artifact.output}
            </Typography>
          </ListItem>
        ))}
      </List>
    </Box>
  )
} 