import { createContext } from 'react'

export type ArtifactType = 'code' | 'visualization' | 'chat'
export type ArtifactSource = 'user' | 'assistant'
export type EditorMode = 'code' | 'plan'

export interface Artifact {
  id: number
  type: ArtifactType
  name: string
  code: string
  output: string
  plotFile: string | null
  source: ArtifactSource
  timestamp: Date
}

export interface ArtifactContextType {
  artifacts: Artifact[]
  activeArtifact: Artifact | null
  setActiveArtifact: (artifact: Artifact | null) => void
  runArtifact: (code: string) => Promise<void>
  updateEditorContent: (content: string) => void
  editorContent: string
  planContent: string
  updatePlanContent: (content: string) => void
  addArtifact: (artifact: Omit<Artifact, 'id' | 'timestamp'>) => void
  mode: EditorMode
  setMode: (mode: EditorMode) => void
}

export const ArtifactContext = createContext<ArtifactContextType | undefined>(undefined) 