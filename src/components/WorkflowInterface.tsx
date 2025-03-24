import {
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useArtifact } from '../contexts/useArtifact';
import { WorkflowStep } from '../contexts/ArtifactContext.types';

interface WorkflowInterfaceProps {
  steps: WorkflowStep[];
}

export default function WorkflowInterface({ steps }: WorkflowInterfaceProps) {
  const { workflowState, startWorkflow, nextStep, previousStep, resetWorkflow } = useArtifact();

  // Safety check for empty steps
  if (!steps || steps.length === 0) {
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No workflow steps defined
        </Typography>
      </Paper>
    );
  }

  const handleStart = () => {
    // If workflow is completed (index >= steps.length) or not started (index === -1), start from beginning
    if (workflowState.currentStepIndex >= steps.length || workflowState.currentStepIndex === -1) {
      startWorkflow(steps);
    } else {
      // Otherwise, continue with the next step
      nextStep();
    }
  };

  const handlePause = () => {
    // TODO: Implement pause functionality
  };

  const progress = workflowState.currentStepIndex >= 0
    ? ((workflowState.currentStepIndex) / steps.length) * 100
    : 0;

  // If we're at or beyond the last step, set progress to 100%
  const finalProgress = workflowState.currentStepIndex >= steps.length ? 100 : progress;

  // Calculate segment size and positions for animation
  const segmentSize = 100 / steps.length;
  const currentSegmentStart = workflowState.currentStepIndex * segmentSize;

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Workflow Progress
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {workflowState.currentStepIndex >= 0 
            ? workflowState.currentStepIndex >= steps.length 
              ? 'Done!' 
              : `Step ${workflowState.currentStepIndex + 1} of ${steps.length}`
            : 'Ready to start'}
        </Typography>
      </Box>

      <Box sx={{ position: 'relative', height: 4, mb: 2, bgcolor: 'grey.200', borderRadius: 1, overflow: 'hidden' }}>
        {/* Base progress bar for completed steps */}
        <Box 
          sx={{ 
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${finalProgress}%`,
            bgcolor: 'primary.main',
            transition: 'width 0.3s ease'
          }}
        />
        
        {/* Animated segment for current step */}
        {workflowState.isRunning && workflowState.currentStepIndex < steps.length && (
          <Box
            sx={{
              position: 'absolute',
              left: `${currentSegmentStart}%`,
              top: 0,
              bottom: 0,
              width: `${segmentSize}%`,
              background: 'linear-gradient(90deg, rgba(25,118,210,0.6) 0%, rgba(25,118,210,0.9) 50%, rgba(25,118,210,0.6) 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              '@keyframes shimmer': {
                '0%': {
                  backgroundPosition: '100% 0',
                },
                '100%': {
                  backgroundPosition: '0% 0',
                },
              },
            }}
          />
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
        <Tooltip title={workflowState.currentStepIndex >= steps.length ? "Start Over" : "Reset Workflow"}>
          <IconButton 
            onClick={resetWorkflow}
            color={workflowState.currentStepIndex >= steps.length ? "primary" : "default"}
          >
            <RestartAltIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Previous Step">
          <IconButton 
            onClick={previousStep}
            disabled={workflowState.currentStepIndex <= 0}
          >
            <SkipPreviousIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title={workflowState.isRunning ? "Pause" : "Start/Resume"}>
          <IconButton onClick={workflowState.isRunning ? handlePause : handleStart}>
            {workflowState.isRunning ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Next Step">
          <IconButton 
            onClick={nextStep}
            disabled={workflowState.currentStepIndex >= steps.length || workflowState.isRunning}
          >
            <SkipNextIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {workflowState.currentStepIndex >= 0 && workflowState.currentStepIndex < steps.length && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Current Step:
          </Typography>
          <Typography variant="body2">
            {steps[workflowState.currentStepIndex]?.prompt || 'No step selected'}
          </Typography>
        </Box>
      )}

      {workflowState.currentStepIndex >= steps.length && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Workflow Complete
          </Typography>
          <Typography variant="body2">
            All steps have been completed successfully!
          </Typography>
        </Box>
      )}
    </Paper>
  );
} 