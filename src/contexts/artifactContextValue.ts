import { ArtifactContextType, Artifact } from './ArtifactContext.types'

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
  planContent: '',
  setPlanContent: () => undefined,
  addArtifact: async () => ({} as Artifact), // Return empty artifact to satisfy Promise<Artifact>
  isRunning: false,
  setIsRunning: () => undefined,
  generateSummary: async () => '',
  togglePin: async () => undefined,
  updateArtifact: () => undefined,
  handleChat: async () => true,
  selectedStep: '',
  setSelectedStep: () => undefined,
  showAllArtifacts: false,
  toggleShowAllArtifacts: () => undefined,
  workflowState: {
    steps: [],
    currentStepIndex: -1,
    isRunning: false,
    lastRelevantArtifactId: 0
  },
  startWorkflow: async () => undefined,
  resumeWorkflow: async () => false,
  nextStep: async () => undefined,
  previousStep: () => undefined,
  resetWorkflow: () => undefined
} 
