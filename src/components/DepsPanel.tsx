import React from 'react';
import { Box, Typography } from '@mui/material';
import { Artifact, ImmediateValue, FileValue } from '../contexts/ArtifactContext.types';
import { useArtifact } from '../contexts/useArtifact';
// Import icons
import FilterListIcon from '@mui/icons-material/FilterList';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import SortIcon from '@mui/icons-material/Sort';
import FunctionsIcon from '@mui/icons-material/Functions';
import StorageIcon from '@mui/icons-material/Storage';
import AssignmentIcon from '@mui/icons-material/Assignment';

interface TransformationInfo {
  operation: string;
  comment?: string;
}

function getTransformationInfo(
  code: string | undefined,
  lineStart: number,
  value: ImmediateValue | FileValue
): TransformationInfo {
  void value;
  if (!code) return { operation: 'unknown' };

  const lines = code.split('\n');
  const line = lines[lineStart - 1];

  // Look for comments above the transformation
  let comment = '';
  let currentLine = lineStart - 2; // Start from line above
  while (currentLine >= 0 && lines[currentLine].trim().startsWith('#')) {
    comment = lines[currentLine].trim().replace('#', '').trim() + '\n' + comment;
    currentLine--;
  }

  // Determine operation type from code
  let operation = 'Assignment';
  if (line.includes('.filter(') || (line.includes('[') && line.includes(']'))) {
    operation = 'Filter';
  } else if (line.includes('.groupby(')) {
    operation = 'Group';
  } else if (line.includes('.merge(') || line.includes('.join(')) {
    operation = 'Join';
  } else if (line.includes('.sort_values(')) {
    operation = 'Sort';
  } else if (line.includes('.any()') || line.includes('.all()')) {
    operation = 'Aggregation';
  } else if (line.includes('read_csv')) {
    operation = 'Data Load';
  }

  return { 
    operation,
    comment: comment.trim() || undefined
  };
}

const operationIcons: Record<string, React.ReactNode> = {
  'Filter': <FilterListIcon fontSize="small" />,
  'Group': <GroupWorkIcon fontSize="small" />,
  'Join': <MergeTypeIcon fontSize="small" />,
  'Sort': <SortIcon fontSize="small" />,
  'Aggregation': <FunctionsIcon fontSize="small" />,
  'Data Load': <StorageIcon fontSize="small" />,
  'Assignment': <AssignmentIcon fontSize="small" />
};

export function DepsPanel({ artifact }: { artifact: Artifact | null }) {
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

  const var2line = artifact.var2line;
  const var2val = artifact.var2val;

  const variables = Object.entries(var2line)
    .sort(([, a], [, b]) => a - b)
    .map(([name]) => {
      const info = getTransformationInfo(
        artifact.code,
        var2line[name],
        var2val[name]
      );
      
      return {
        name,
        line: var2line[name],
        value: var2val[name],
        info
      };
    });

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        Data Transformation Pipeline
      </Typography>
      
      <Box sx={{ my: 2 }}>
        {variables.map((variable, index) => (
          <Box 
            key={variable.name}
            sx={{ mb: 2, display: 'flex', flexDirection: 'column', position: 'relative' }}
          >
            {/* Connection line */}
            {index < variables.length - 1 && (
              <Box sx={{
                position: 'absolute',
                left: '12px',
                top: '24px',
                bottom: '-24px',
                width: '2px',
                bgcolor: 'divider',
                zIndex: 0
              }} />
            )}
            
            {/* Variable node */}
            <Box 
              onClick={() => setSelectedStep(variable.name)}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
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
                fontSize: '0.875rem',
                flexShrink: 0,
                mt: 1,
                position: 'relative',
                zIndex: 2
              }}>
                {index + 1}
              </Box>
              
              {/* Variable info */}
              <Box 
                className="variable-info"
                sx={{
                  flex: 1,
                  p: 1.5,
                  bgcolor: selectedStep === variable.name ? 'action.selected' : 'background.paper',
                  borderRadius: 1,
                  border: 1,
                  borderColor: selectedStep === variable.name ? 'primary.main' : 'divider',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  zIndex: 2
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="subtitle2">
                    {variable.name}
                  </Typography>
                  <Box 
                    sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1, 
                      py: 0.5, 
                      bgcolor: 'primary.main',
                      color: 'white',
                      borderRadius: 1
                    }}
                  >
                    {operationIcons[variable.info.operation]}
                    <Typography variant="caption">
                      {variable.info.operation}
                    </Typography>
                  </Box>
                </Box>

                {variable.info.comment && (
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ 
                      whiteSpace: 'pre-line'  // Preserve line breaks in comments
                    }}
                  >
                    {variable.info.comment}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
} 