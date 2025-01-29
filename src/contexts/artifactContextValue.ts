import { ArtifactContextType } from './ArtifactContext.types'

export const initialArtifactContextValue: ArtifactContextType = {
  artifacts: [],
  activeArtifact: null,
  setActiveArtifact: () => void 0,
  runArtifact: async () => void 0,
  updateEditorContent: () => void 0,
  editorContent: '',
  addArtifact: () => void 0,
} 