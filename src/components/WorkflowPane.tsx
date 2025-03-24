import React, { forwardRef, useImperativeHandle } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  IconButton, 
  Paper, 
  Tooltip, 
  LinearProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Menu,
  MenuItem,
  Divider,
  InputAdornment
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PauseIcon from '@mui/icons-material/Pause';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveIcon from '@mui/icons-material/Save';
import { useWorkflow } from '../hooks/useWorkflow';
import { SavedWorkflow } from '../contexts/ArtifactContext.types';

// Export the handle type for parent components to use
export type WorkflowPaneHandle = {
  handleSave: () => Promise<boolean>;
  handleStart: () => Promise<boolean>;
};

// Define props type
type WorkflowPaneProps = {
  className?: string; // Optional dummy prop to satisfy TypeScript
};

export default forwardRef<WorkflowPaneHandle, WorkflowPaneProps>(function WorkflowPane(props, ref) {
  void props;
  const {
    steps,
    savedWorkflows,
    workflowState,
    isSaving,
    handleStepChange,
    addStep,
    removeStep,
    moveStep,
    loadWorkflow,
    deleteWorkflow,
    startWorkflow,
    nextStep,
    previousStep,
    resetWorkflow,
    isEditingEnabled,
    saveWorkflowAsArtifact
  } = useWorkflow();
  
  // UI state
  const [showSaveMessage, setShowSaveMessage] = React.useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = React.useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = React.useState(false);
  const [workflowName, setWorkflowName] = React.useState('');
  const [messageText, setMessageText] = React.useState('');
  
  // Menu state for saved workflow items
  const [menuAnchorEl, setMenuAnchorEl] = React.useState<null | HTMLElement>(null);
  const [selectedWorkflow, setSelectedWorkflow] = React.useState<SavedWorkflow | null>(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    handleSave: async () => {
      try {
        // When the save button is clicked, open the save dialog 
        // instead of silently saving
        handleOpenSaveDialog();
        return true;
      } catch (error) {
        console.error('Error in handleSave:', error);
        return false;
      }
    },
    
    handleStart: async () => {
      // Validate steps before starting
      const validSteps = steps.filter(step => step.prompt.trim().length > 0);
      if (validSteps.length === 0) {
        alert('Please add at least one step with content before starting the workflow');
        return false;
      }
      
      // Start workflow with valid steps only
      try {
        await startWorkflow(validSteps);
        return true;
      } catch (error) {
        console.error('Error starting workflow:', error);
        return false;
      }
    }
  }));

  const handleOpenLoadDialog = () => {
    setLoadDialogOpen(true);
  };
  
  const handleCloseLoadDialog = () => {
    setLoadDialogOpen(false);
  };
  
  const handleLoadWorkflow = async (workflow: SavedWorkflow) => {
    console.log('Loading workflow:', workflow);
    try {
      const result = await loadWorkflow(workflow);
      console.log('Load workflow result:', result);
      setLoadDialogOpen(false);
      setMessageText(`Workflow "${workflow.name}" loaded`);
      setShowSaveMessage(true);
    } catch (error) {
      console.error('Error in handleLoadWorkflow:', error);
    }
  };
  
  const handleOpenWorkflowMenu = (event: React.MouseEvent<HTMLButtonElement>, workflow: SavedWorkflow) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedWorkflow(workflow);
  };
  
  const handleCloseWorkflowMenu = () => {
    setMenuAnchorEl(null);
  };
  
  const handleDeleteWorkflow = async () => {
    if (selectedWorkflow) {
      await deleteWorkflow(selectedWorkflow);
      setMenuAnchorEl(null);
      setMessageText(`Workflow "${selectedWorkflow.name}" deleted`);
      setShowSaveMessage(true);
    }
  };
  
  const handleCloseSnackbar = () => {
    setShowSaveMessage(false);
  };

  const handleOpenSaveDialog = () => {
    if (steps.length === 0 || steps.every(s => !s.prompt.trim())) {
      alert('Please add at least one step with content before saving a workflow');
      return;
    }
    setWorkflowName('');
    setSaveDialogOpen(true);
  };
  
  const handleCloseSaveDialog = () => {
    setSaveDialogOpen(false);
  };
  
  const handleSaveWorkflow = async () => {
    if (!workflowName.trim()) return;
    
    try {
      console.log('Saving workflow as:', workflowName);
      const result = await saveWorkflowAsArtifact(workflowName);
      console.log('Save workflow result:', result);
      if (result) {
        setMessageText(`Workflow "${workflowName}" saved successfully`);
        setShowSaveMessage(true);
        setSaveDialogOpen(false);
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
    }
  };

  // Format date for display
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Workflow Steps</Typography>
        
        {workflowState.isRunning ? (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              variant="outlined" 
              startIcon={<PauseIcon />} 
              onClick={resetWorkflow}
              size="small"
              disabled={isSaving}
            >
              Stop
            </Button>
            <Button 
              variant="outlined" 
              onClick={previousStep} 
              disabled={workflowState.currentStepIndex <= 0 || isSaving}
              size="small"
            >
              Previous
            </Button>
            <Button 
              variant="outlined" 
              onClick={nextStep}
              disabled={workflowState.currentStepIndex >= workflowState.steps.length - 1 || isSaving}
              size="small"
            >
              Next
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<FolderOpenIcon />}
              onClick={handleOpenLoadDialog}
              disabled={isSaving || savedWorkflows.length === 0}
              size="small"
            >
              Load
            </Button>
            {steps.length > 0 && (
              <Button
                variant="outlined"
                color="error"
                onClick={resetWorkflow}
                disabled={isSaving}
                size="small"
              >
                Clear
              </Button>
            )}
          </Box>
        )}
      </Box>
      
      {/* Status indicators */}
      {isSaving && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress sx={{ height: 6, borderRadius: 3 }} />
          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
            Saving...
          </Typography>
        </Box>
      )}
      
      {workflowState.isRunning && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Current Step: {workflowState.currentStepIndex + 1} of {workflowState.steps.length}
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={((workflowState.currentStepIndex + 1) / workflowState.steps.length) * 100} 
            sx={{ height: 10, borderRadius: 5 }}
          />
        </Box>
      )}

      {steps.length === 0 && !workflowState.isRunning && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Add steps to your workflow using the button below. Each step will be sent as a prompt when the workflow runs.
        </Alert>
      )}
      
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {steps.map((step, index) => (
          <Paper 
            key={index} 
            elevation={1} 
            sx={{ 
              p: 2, 
              mb: 2, 
              border: workflowState.isRunning && index === workflowState.currentStepIndex ? 
                '2px solid #1976d2' : '1px solid #e0e0e0',
              backgroundColor: workflowState.isRunning && index < workflowState.currentStepIndex ?
                '#e3f2fd' : 'white'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle1">Step {index + 1}</Typography>
              
              {isEditingEnabled && (
                <Box sx={{ display: 'flex' }}>
                  <Tooltip title="Move Up">
                    <span>
                      <IconButton 
                        size="small" 
                        onClick={() => moveStep(index, 'up')}
                        disabled={index === 0 || isSaving}
                      >
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  
                  <Tooltip title="Move Down">
                    <span>
                      <IconButton 
                        size="small" 
                        onClick={() => moveStep(index, 'down')}
                        disabled={index === steps.length - 1 || isSaving}
                      >
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  
                  <Tooltip title="Delete Step">
                    <IconButton 
                      size="small" 
                      onClick={() => removeStep(index)}
                      color="error"
                      disabled={isSaving}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>
            
            <TextField
              fullWidth
              multiline
              minRows={2}
              maxRows={6}
              value={step.prompt}
              onChange={(e) => handleStepChange(index, e.target.value)}
              placeholder="Enter prompt for this step..."
              disabled={!isEditingEnabled || isSaving}
              variant="outlined"
              size="small"
            />
          </Paper>
        ))}
      </Box>
      
      {isEditingEnabled && (
        <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined" 
            startIcon={<AddIcon />} 
            onClick={addStep}
            fullWidth
            disabled={isSaving}
          >
            Add Step
          </Button>
        </Box>
      )}
      
      {/* Load Workflow Dialog with fixed ListItem */}
      <Dialog 
        open={loadDialogOpen} 
        onClose={handleCloseLoadDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Load Workflow Template</DialogTitle>
        <DialogContent>
          {savedWorkflows.length === 0 ? (
            <Typography>No saved workflows found</Typography>
          ) : (
            <List>
              {savedWorkflows.map((workflow, index) => (
                <React.Fragment key={`${workflow.name}-${workflow.createdAt}`}>
                  <ListItem onClick={() => handleLoadWorkflow(workflow)} sx={{ cursor: 'pointer' }}>
                    <ListItemText 
                      primary={workflow.name} 
                      secondary={`${workflow.steps.length} steps • Created: ${formatDate(workflow.createdAt)}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton 
                        edge="end" 
                        aria-label="more"
                        onClick={(e) => handleOpenWorkflowMenu(e, workflow)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < savedWorkflows.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseLoadDialog}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Workflow Item Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleCloseWorkflowMenu}
      >
        <MenuItem onClick={handleDeleteWorkflow}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
      
      {/* Save Workflow Dialog */}
      <Dialog open={saveDialogOpen} onClose={handleCloseSaveDialog}>
        <DialogTitle>Save Workflow</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Workflow Name"
            fullWidth
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SaveIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSaveDialog}>Cancel</Button>
          <Button 
            onClick={handleSaveWorkflow} 
            color="primary" 
            disabled={!workflowName.trim() || isSaving}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Notification Snackbar */}
      <Snackbar
        open={showSaveMessage}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        message={messageText}
      />
    </Box>
  );
}); 