import { createContext } from 'react';

// Define the structure of a pipeline step
export interface PipelineStep {
  id: string;
  name: string;
  description: string;
  artifactId?: number;
  completed: boolean;
  output?: string;
}

// Define the structure of a pipeline
export interface Pipeline {
  id: string;
  name: string;
  description: string;
  steps: PipelineStep[];
  currentStepIndex: number;
  completed: boolean;
}

// Define the context type
export interface PipelineContextType {
  pipelines: Pipeline[];
  activePipeline: Pipeline | null;
  createPipeline: (name: string, description: string, steps: Omit<PipelineStep, 'id' | 'completed'>[]) => Pipeline;
  startPipeline: (pipelineId: string) => void;
  completeCurrentStep: (output: string, artifactId?: number) => void;
  moveToNextStep: () => void;
  getPipelineContext: () => string;
}

// Create the context
export const PipelineContext = createContext<PipelineContextType | undefined>(undefined); 