import React from 'react';
import { Box, Typography } from '@mui/material';
import WorkflowInterface from './WorkflowInterface';
import { WorkflowStep } from '../contexts/ArtifactContext.types';

const exampleWorkflowSteps: WorkflowStep[] = [
  {
    prompt: "Write code to inspect the given datasets and output their characteristics.",
  },
  {
    prompt: "Given the inspected datasets, write code to plot something interesting about them.",
  },
];

const WorkflowPane: React.FC = () => {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Data Inspection & Visualization Workflow</Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        This workflow will help you inspect your data and create meaningful visualizations.
        Each step will build on the previous one to create a comprehensive analysis.
      </Typography>
      <WorkflowInterface steps={exampleWorkflowSteps} />
    </Box>
  );
};

export default WorkflowPane; 