export type ViewMode = 'plot' | 'data' | 'output' 

export interface Artifact {
  id: number
  name: string
  output: string
  plotFile?: string
  dataFile?: string
  type: 'chat' | 'code' | 'visualization' | 'data'
  timestamp: number
  code?: string
  source?: string
  pinned?: boolean
  chatInput?: string
} 