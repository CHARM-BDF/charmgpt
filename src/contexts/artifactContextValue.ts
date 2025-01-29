import { ArtifactContextType } from './ArtifactContext.types'

export const defaultArtifactContextValue: ArtifactContextType = {
  artifacts: [],
  activeArtifact: null,
  setActiveArtifact: () => {},
  runArtifact: async () => {},
  updateEditorContent: () => {},
} 