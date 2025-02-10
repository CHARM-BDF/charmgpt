import { createContext } from 'react'

export type EditorMode = 'code' | 'plan'
export type ViewMode = 'plot' | 'data' | 'output'

export type ArtifactType = 'chat' | 'code' | 'visualization' | 'data'

/**
 * Gets the display name for a file by removing the runId prefix.
 * This matches the server-side logic for symlink names.
 */
export const getDisplayName = (artifact: Artifact): string => {
  if (!artifact.dataFile) {
    return artifact.name
  }
  // Use a display name based on the artifact name or original filename
  const displayName = artifact.name.endsWith('.csv')
    ? artifact.name
    : artifact.dataFile.replace(/^[^_]+_/, '') // Remove runId prefix
  return displayName
}

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
  isRunning: boolean
  setIsRunning: (running: boolean) => void
  generateSummary: () => Promise<string>
}

export const ArtifactContext = createContext<ArtifactContextType | undefined>(undefined) 