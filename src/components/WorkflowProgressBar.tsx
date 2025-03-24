import React from 'react';
import { Box, SxProps, Theme } from '@mui/material';
import { WorkflowStep } from '../contexts/ArtifactContext.types';

// Animation styles to inject once
const ANIMATION_STYLE_ID = 'workflow-progress-animation';
const ANIMATION_CSS = `
@keyframes pulse-opacity {
  0% { opacity: 0.6; }
  50% { opacity: 0.9; }
  100% { opacity: 0.6; }
}

@keyframes flow-gradient {
  0% { background-position: 0% 0; }
  100% { background-position: 100% 0; }
}

.workflow-current-step-animated {
  animation: pulse-opacity 2s infinite ease-in-out, flow-gradient 1.5s infinite linear;
  background: linear-gradient(90deg, 
    rgba(25,118,210,0.6) 0%, 
    rgba(66,165,245,0.9) 50%, 
    rgba(25,118,210,0.6) 100%
  );
  background-size: 200% 100%;
}
`;

export interface WorkflowProgressBarProps {
  steps: WorkflowStep[] | readonly WorkflowStep[];
  currentStepIndex: number;
  isRunning: boolean;
  containerSx?: SxProps<Theme>;
}

export const WorkflowProgressBar: React.FC<WorkflowProgressBarProps> = ({ 
  steps, 
  currentStepIndex, 
  isRunning,
  containerSx 
}) => {
  // Add the animation styles to the document head
  React.useEffect(() => {
    if (!document.getElementById(ANIMATION_STYLE_ID)) {
      const styleEl = document.createElement('style');
      styleEl.id = ANIMATION_STYLE_ID;
      styleEl.textContent = ANIMATION_CSS;
      document.head.appendChild(styleEl);
    }
    
    return () => {
      // We don't clean up as other instances might be using this
    };
  }, []);
  
  if (!steps || steps.length === 0) {
    return null;
  }

  // Calculate if we're at the final step or beyond
  const isComplete = currentStepIndex >= steps.length;
  
  // Determine if there's an active step
  const hasActiveStep = currentStepIndex >= 0 && !isComplete;
  
  return (
    <Box sx={{ 
      position: 'relative', 
      height: 6,
      bgcolor: 'grey.300',
      borderRadius: 3, 
      overflow: 'hidden',
      ...containerSx 
    }}>
      {/* Base progress bar for completed steps - only show if we have completed steps */}
      {currentStepIndex > 0 && (
        <Box 
          sx={{ 
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${currentStepIndex * (100 / steps.length)}%`,
            bgcolor: 'primary.main',
            transition: 'width 0.3s ease'
          }}
        />
      )}
      
      {/* Current step indicator with animation - directly inline styles for reliability */}
      {hasActiveStep && isRunning && (
        <Box
          sx={{
            position: 'absolute',
            left: `${currentStepIndex * (100 / steps.length)}%`,
            top: 0,
            bottom: 0,
            width: `${100 / steps.length}%`,
            background: 'linear-gradient(90deg, rgba(25,118,210,0.6) 0%, rgba(66,165,245,0.9) 50%, rgba(25,118,210,0.6) 100%)',
            backgroundSize: '200% 100%',
            animation: 'workflow-progress-animation 1.5s infinite linear',
            transition: 'left 0.3s ease, width 0.3s ease',
            '@keyframes workflow-progress-animation': {
              '0%': {
                backgroundPosition: '0% 0'
              },
              '100%': {
                backgroundPosition: '100% 0'
              }
            }
          }}
        />
      )}
      
      {/* Complete indicator for finished workflow */}
      {isComplete && (
        <Box 
          sx={{ 
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '100%',
            bgcolor: 'primary.main',
            transition: 'width 0.3s ease'
          }}
        />
      )}
      
      {/* Step markers */}
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex' }}>
        {steps.map((_, index) => (
          <Box 
            key={index}
            sx={{ 
              flex: 1,
              borderRight: index < steps.length - 1 ? '1px solid rgba(255,255,255,0.5)' : 'none',
            }}
          />
        ))}
      </Box>
    </Box>
  );
}; 