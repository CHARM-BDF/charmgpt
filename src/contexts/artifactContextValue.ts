import { ArtifactContextType } from './ArtifactContext.types'

export const artifactContextValue: ArtifactContextType = {
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
  addArtifact: () => undefined,
  planContent: '',
  setPlanContent: () => undefined,
  isRunning: false,
  setIsRunning: () => undefined,
  generateSummary: async () => '',
  togglePin: async () => undefined,
  updateArtifact: () => undefined,
  handleChat: async () => undefined
} 