import { Box, Typography } from '@mui/material';
import { Artifact } from '../contexts/ArtifactContext.types';
import { useArtifact } from '../contexts/useArtifact';

interface DepsPanelProps {
  artifact: Artifact | null;
}

export function DepsPanel({ artifact }: DepsPanelProps) {
  const { setSelectedStep, selectedStep } = useArtifact();

  if (!artifact?.var2line || !artifact?.var2val) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>
          No data transformation pipeline available. Run some code first to see the dependencies.
        </Typography>
      </Box>
    );
  }

  // Create a safe reference to the objects we'll use
  const var2line = artifact.var2line;
  const var2line_end = artifact.var2line_end || {};
  const var2val = artifact.var2val;

  // Sort variables by line number to show execution order
  const variables = Object.entries(var2line)
    .sort(([, a], [, b]) => a - b)
    .map(([name]) => ({
      name,
      line: var2line[name],
      lineEnd: var2line_end[name] || var2line[name],
      value: var2val[name]
    }));

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        Data Transformation Pipeline
      </Typography>
      
      <Box sx={{ my: 2 }}>
        {variables.map((variable, index) => (
          <Box 
            key={variable.name}
            sx={{ 
              mb: 2,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}
          >
            {/* Connection line */}
            {index < variables.length - 1 && (
              <Box sx={{
                position: 'absolute',
                left: '12px',
                top: '24px',
                bottom: '-24px',
                width: '2px',
                bgcolor: 'divider'
              }} />
            )}
            
            {/* Variable node */}
            <Box 
              onClick={() => setSelectedStep(variable.name)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                position: 'relative',
                zIndex: 1,
                cursor: 'pointer',
                '&:hover': {
                  '& .variable-info': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover',
                  }
                }
              }}
            >
              {/* Step indicator */}
              <Box sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                bgcolor: selectedStep === variable.name ? 'primary.dark' : 'primary.main',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.875rem'
              }}>
                {index + 1}
              </Box>
              
              {/* Variable info */}
              <Box 
                className="variable-info"
                sx={{
                  flex: 1,
                  p: 1,
                  bgcolor: selectedStep === variable.name ? 'action.selected' : 'background.paper',
                  borderRadius: 1,
                  border: 1,
                  borderColor: selectedStep === variable.name ? 'primary.main' : 'divider',
                  transition: 'all 0.2s ease'
                }}
              >
                <Typography variant="subtitle2">
                  {variable.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {variable.value.type === 'file' ? 'DataFrame' : 'Value'} • Line {variable.line}
                </Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
} 