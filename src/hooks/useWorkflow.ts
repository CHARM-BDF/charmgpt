import { useState, useEffect, useCallback } from 'react';
import { useArtifact } from '../contexts/useArtifact';
import { WorkflowStep, SavedWorkflow } from '../contexts/ArtifactContext.types';

export const useWorkflow = () => {
  const { workflowState, startWorkflow, resetWorkflow, nextStep, previousStep, addArtifact } = useArtifact();
  const [localSteps, setLocalSteps] = useState<WorkflowStep[]>([]);
  const [hasLoadedFromServer, setHasLoadedFromServer] = useState(false);
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Load steps from server on first mount
  useEffect(() => {
    const loadWorkflowSteps = async () => {
      try {
        const response = await fetch('/api/artifacts/workflow');
        if (response.ok) {
          const { steps } = await response.json();
          if (steps && Array.isArray(steps)) {
            setLocalSteps(steps);
          }
        }
        setHasLoadedFromServer(true);
      } catch (error) {
        console.error('Error loading workflow steps from server:', error);
        setHasLoadedFromServer(true);
      }
    };

    const loadSavedWorkflows = async () => {
      try {
        const response = await fetch('/api/artifacts/saved-workflows');
        if (response.ok) {
          const { workflows } = await response.json();
          if (workflows && Array.isArray(workflows)) {
            setSavedWorkflows(workflows);
          }
        }
      } catch (error) {
        console.error('Error loading saved workflows:', error);
      }
    };

    loadWorkflowSteps();
    loadSavedWorkflows();
  }, []);

  // Sync with workflow state when it changes
  useEffect(() => {
    if (workflowState.steps.length > 0 && hasLoadedFromServer) {
      setLocalSteps(workflowState.steps);
    }
  }, [workflowState.steps, hasLoadedFromServer]);

  // Save steps to server only when explicitly requested
  const saveWorkflowSteps = useCallback(async (steps: WorkflowStep[]) => {
    setIsSaving(true);
    try {
      await fetch('/api/artifacts/workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ steps })
      });
      setLocalSteps(steps);
    } catch (error) {
      console.error('Error saving workflow steps to server:', error);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Save the current workflow as a named artifact
  const saveWorkflowAsArtifact = useCallback(async (name: string) => {
    if (!name.trim() || localSteps.length === 0) return false;

    setIsSaving(true);
    try {
      // Create a saved workflow object
      const savedWorkflow: SavedWorkflow = {
        name: name.trim(),
        steps: localSteps,
        createdAt: Date.now()
      };

      // Save to server
      const response = await fetch('/api/artifacts/saved-workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ workflow: savedWorkflow })
      });

      if (!response.ok) {
        throw new Error('Failed to save workflow');
      }

      // Also save as an artifact for visibility in the artifact list
      await addArtifact({
        type: 'workflow',
        name: `Workflow: ${name.trim()}`,
        workflowSteps: localSteps,
        workflowStepIndex: -1, // Not running
        source: 'user',
        pinned: true,
        output: JSON.stringify(savedWorkflow, null, 2)
      });

      // Update local list
      setSavedWorkflows(prev => [...prev, savedWorkflow]);
      return true;
    } catch (error) {
      console.error('Error saving workflow as artifact:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [localSteps, addArtifact]);

  // Load a saved workflow
  const loadWorkflow = useCallback(async (savedWorkflow: SavedWorkflow) => {
    setIsSaving(true);
    try {
      // Update local steps
      setLocalSteps(savedWorkflow.steps);
      
      // Save to current workflow file
      await fetch('/api/artifacts/workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ steps: savedWorkflow.steps })
      });
      
      return true;
    } catch (error) {
      console.error('Error loading workflow:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Delete a saved workflow
  const deleteWorkflow = useCallback(async (savedWorkflow: SavedWorkflow) => {
    setIsSaving(true);
    try {
      // Delete from server
      const response = await fetch('/api/artifacts/saved-workflows/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: savedWorkflow.name, createdAt: savedWorkflow.createdAt })
      });

      if (!response.ok) {
        throw new Error('Failed to delete workflow');
      }

      // Update local list
      setSavedWorkflows(prev => 
        prev.filter(w => 
          !(w.name === savedWorkflow.name && w.createdAt === savedWorkflow.createdAt)
        )
      );
      
      return true;
    } catch (error) {
      console.error('Error deleting workflow:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Start workflow with the provided steps and save them
  const startWorkflowWithSave = useCallback(async (steps: WorkflowStep[]) => {
    setIsSaving(true);
    try {
      await saveWorkflowSteps(steps);
      startWorkflow(steps);
    } finally {
      setIsSaving(false);
    }
  }, [saveWorkflowSteps, startWorkflow]);

  // Simple function to update step content without saving
  const handleStepChange = useCallback((index: number, prompt: string) => {
    setLocalSteps(prevSteps => {
      const updatedSteps = [...prevSteps];
      updatedSteps[index] = { ...updatedSteps[index], prompt };
      return updatedSteps;
    });
  }, []);

  // Helper function to add a new step without saving
  const addStep = useCallback(() => {
    setLocalSteps(prevSteps => [...prevSteps, { prompt: '' }]);
  }, []);

  // Helper function to remove a step without saving
  const removeStep = useCallback((index: number) => {
    setLocalSteps(prevSteps => prevSteps.filter((_, i) => i !== index));
  }, []);

  // Helper function to move a step up or down without saving
  const moveStep = useCallback((index: number, direction: 'up' | 'down') => {
    setLocalSteps(prevSteps => {
      const updatedSteps = [...prevSteps];
      
      if (direction === 'up' && index > 0) {
        [updatedSteps[index - 1], updatedSteps[index]] = [updatedSteps[index], updatedSteps[index - 1]];
      } else if (direction === 'down' && index < prevSteps.length - 1) {
        [updatedSteps[index], updatedSteps[index + 1]] = [updatedSteps[index + 1], updatedSteps[index]];
      }
      
      return updatedSteps;
    });
  }, []);

  // Clear all steps
  const clearSteps = useCallback(async () => {
    setIsSaving(true);
    try {
      await fetch('/api/artifacts/workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ steps: [] })
      });
      setLocalSteps([]);
      resetWorkflow();
    } catch (error) {
      console.error('Error clearing workflow steps:', error);
    } finally {
      setIsSaving(false);
    }
  }, [resetWorkflow]);

  return {
    steps: localSteps,
    savedWorkflows,
    workflowState,
    isSaving,
    handleStepChange,
    addStep,
    removeStep,
    moveStep,
    saveWorkflowSteps,
    saveWorkflowAsArtifact,
    loadWorkflow,
    deleteWorkflow,
    startWorkflow: startWorkflowWithSave,
    nextStep,
    previousStep,
    resetWorkflow: clearSteps,
    isEditingEnabled: !workflowState.isRunning, // Editing is only allowed when not running
  };
}; 