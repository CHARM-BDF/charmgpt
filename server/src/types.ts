export type ViewMode = 'plot' | 'data' | 'output' 

export interface Artifact {
  id: number
  type: 'chat' | 'code' | 'visualization' | 'data'
  name: string
  code?: string
  output: string
  plotFile?: string
  dataFile?: string
  dataFiles: Record<string, string>  // Map of step name to file name
  lineNumbers: Record<string, number[]>  // Map of step name to array of line numbers
  source?: string
  chatInput?: string
  pinned?: boolean
  timestamp: number
} 