import { createContext } from 'react'
import { ArtifactContextType } from './ArtifactContext.types'

export const ArtifactContext = createContext<ArtifactContextType>({
  artifacts: [],
  activeArtifact: null,
  setActiveArtifact: () => {},
  runArtifact: async () => {},
  updateEditorContent: () => {},
}) 