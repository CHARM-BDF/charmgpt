import { createContext } from 'react'

export type EditorMode = 'code' | 'plan'
export type ViewMode = 'plot' | 'data' | 'output'

export type ArtifactType = 'chat' | 'code' | 'visualization' | 'data'

export interface Artifact {
  id: number
  name: string
  output: string
  plotFile?: string
  dataFile?: string
  type: ArtifactType
  timestamp: number
  code?: string
  source?: string
}

export interface ArtifactContextType {
  artifacts: Artifact[]
  activeArtifact: Artifact | null
  viewMode: ViewMode
  mode: EditorMode
  setMode: (mode: EditorMode) => void
  setViewMode: (mode: ViewMode) => void
  setActiveArtifact: (artifact: Artifact | null) => void
  runArtifact: (code: string, name?: string) => Promise<void>
  editorContent: string
  setEditorContent: (content: string) => void
  planContent: string
  setPlanContent: (content: string) => void
  addArtifact: (artifact: Omit<Artifact, 'id' | 'timestamp'>) => void
}

export const ArtifactContext = createContext<ArtifactContextType | undefined>(undefined) 