import { createContext } from 'react'

export type EditorMode = 'code' | 'plan'

export type ArtifactType = 'code' | 'visualization'

export type Artifact = {
  id: number
  name: string
  code: string
  output: string
  plotFile?: string
  dataFile?: string
  timestamp: number
  type: ArtifactType
  source: 'user' | 'assistant'
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