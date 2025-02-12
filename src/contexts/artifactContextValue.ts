import { ArtifactContextType } from './ArtifactContext.types'

export const defaultContextValue: ArtifactContextType = {
  artifacts: [],
  activeArtifact: null,
  viewMode: 'plot',
  mode: 'code',
  setMode: () => undefined,
  setViewMode: () => undefined,
  setActiveArtifact: () => undefined,
  runArtifact: async () => undefined,
  editorContent: '',
  setEditorContent: () => undefined,
  planContent: '',
  setPlanContent: () => undefined,
  addArtifact: () => undefined,
  isRunning: false,
  setIsRunning: () => undefined,
  generateSummary: async () => '',
  togglePin: async () => undefined,
  updateArtifact: () => undefined,
  handleChat: async () => undefined,
  selectedStep: '',
  setSelectedStep: () => undefined
} 