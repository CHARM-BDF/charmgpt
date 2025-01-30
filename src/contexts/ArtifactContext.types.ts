import { createContext } from 'react'

export type EditorMode = 'code' | 'plan'
export type ViewMode = 'plot' | 'data'

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
  mode: EditorMode
  setMode: (mode: EditorMode) => void
  runArtifact: (code: string) => Promise<void>
  editorContent: string
  setEditorContent: (content: string) => void
  planContent: string
  setPlanContent: (content: string) => void
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  addArtifact: (artifact: Omit<Artifact, 'id' | 'timestamp'>) => void
  updateEditorContent: (content: string) => void
  updatePlanContent: (content: string) => void
}

export const ArtifactContext = createContext<ArtifactContextType | undefined>(undefined) 