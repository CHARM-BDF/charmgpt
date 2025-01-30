import { ArtifactContextType } from './ArtifactContext.types'

export const initialArtifactContextValue: ArtifactContextType = {
  artifacts: [],
  activeArtifact: null,
  viewMode: 'plot',
  mode: 'code',
  setMode: () => void 0,
  setViewMode: () => void 0,
  setActiveArtifact: () => void 0,
  runArtifact: async () => void 0,
  updateEditorContent: () => void 0,
  editorContent: '',
  addArtifact: () => void 0,
  setEditorContent: () => void 0,
  planContent: '',
  setPlanContent: () => void 0,
} 