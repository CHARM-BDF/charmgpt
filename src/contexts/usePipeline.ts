import { useContext } from 'react';
import { PipelineContext, PipelineContextType } from './pipelineTypes.ts';

export function usePipeline(): PipelineContextType {
  const context = useContext(PipelineContext);
  if (!context) {
    throw new Error('usePipeline must be used within a PipelineProvider');
  }
  return context;
} 