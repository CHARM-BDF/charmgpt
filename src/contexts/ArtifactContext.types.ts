import { createContext } from 'react'

export type ArtifactType = 'code' | 'visualization'
export type ArtifactSource = 'user' | 'chat'

export interface Artifact {
  id: number
  code: string
  output: string
  timestamp: Date
  type: ArtifactType
  name: string
  source: ArtifactSource
  parentId?: number
  description?: string
  plotFile?: string
}

export interface ArtifactContextType {
  activeArtifact: Artifact | null
  setActiveArtifact: (artifact: Artifact | null) => void
  artifacts: Artifact[]
  addArtifact: (
    code: string,
    name: string,
    type: ArtifactType,
    options?: {
      parentId?: number
      source?: ArtifactSource
      description?: string
      output?: string
      plotFile?: string
    }
  ) => Artifact
  runArtifact: (artifact: Artifact) => Promise<Artifact>
  editorContent: string
  updateEditorContent: (content: string) => void
}

export const ArtifactContext = createContext<ArtifactContextType | undefined>(undefined) 