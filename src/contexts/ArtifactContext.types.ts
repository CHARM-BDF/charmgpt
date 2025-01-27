import { createContext } from 'react'
import { Artifact } from '../components/ArtifactList'

export interface ArtifactContextType {
  activeArtifact: Artifact | null
  setActiveArtifact: (artifact: Artifact | null) => void
  addArtifact: (code: string, output: string, type: 'code' | 'visualization') => void
  artifacts: Artifact[]
  runArtifact: (artifact: Artifact) => Promise<void>
}

export const ArtifactContext = createContext<ArtifactContextType | undefined>(undefined) 