import { createContext } from 'react'
import { Artifact } from '../components/ArtifactList'

export interface ArtifactContext {
  activeArtifact: Artifact | null
  setActiveArtifact: (artifact: Artifact | null) => void
  addArtifact: (code: string, output: string, type: 'code' | 'visualization', plotFile?: string) => void
  artifacts: Artifact[]
  runArtifact: (artifact: Artifact) => Promise<void>
  editorContent: string
  updateEditorContent: (content: string) => void
}

export const ArtifactContext = createContext<ArtifactContext | undefined>(undefined) 