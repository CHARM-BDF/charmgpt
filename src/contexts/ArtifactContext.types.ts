import { createContext } from 'react'

export type ArtifactType = 'code' | 'visualization'
export type ArtifactSource = 'user' | 'assistant'

export interface Artifact {
  id: number
  type: ArtifactType
  name: string
  code: string
  output: string
  plotFile?: string
  source: ArtifactSource
  timestamp: Date
}

export interface ArtifactContextType {
  artifacts: Artifact[]
  activeArtifact: Artifact | null
  setActiveArtifact: (artifact: Artifact | null) => void
  runArtifact: (code: string) => Promise<void>
  updateEditorContent: (content: string) => void
}

export const ArtifactContext = createContext<ArtifactContextType | undefined>(undefined) 