import { createContext } from 'react'

export type EditorMode = 'code' | 'plan' | 'deps'
export type ViewMode = 'plot' | 'data' | 'output'
export type CodeLanguage = 'python' | 'r'

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

export const dataHeader = (dataFile?: string): string|undefined => {
  if (!dataFile) return undefined;

  // Use XMLHttpRequest for sync request
  const xhr = new XMLHttpRequest();
  xhr.open('GET', `/api/header/${dataFile}`, false);  // false makes it synchronous
  xhr.send(null);

  if (xhr.status === 200) {
    return xhr.responseText;
  }

  return undefined;
}

export interface ProcessingJob {
  jobId: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  type: 'conversion' | 'summary';
  error?: string;
}

export interface ImmediateValue {
  type: 'immediate'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
}

export interface FileValue {
  type: 'file'
  value: string  // filename
}

export interface Artifact {
  id: number
  name: string
  output: string
  plotFile?: string
  plotFiles?: string[]
  type: ArtifactType
  timestamp: number
  code?: string
  source?: string
  pinned?: boolean
  chatInput?: string
  processingJob?: ProcessingJob
  language?: CodeLanguage
  // New structure for variables - make these optional
  var2val?: Record<string, ImmediateValue | FileValue>
  var2line?: Record<string, number>
  var2line_end?: Record<string, number>
  // Keep for uploads
  dataFile?: string
  // Parent-child relationship fields
  parentId?: number
  blockIndex?: number
}

export interface ArtifactContextType {
  artifacts: Artifact[]
  activeArtifact: Artifact | null
  viewMode: ViewMode
  mode: EditorMode
  setMode: (mode: EditorMode) => void
  setViewMode: (mode: ViewMode) => void
  setActiveArtifact: (artifact: Artifact | null) => void
  runArtifact: (code: string, language?: CodeLanguage, options?: { parentId?: number, blockIndex?: number }) => Promise<void>
  editorContent: string
  setEditorContent: (content: string) => void
  planContent: string
  setPlanContent: (content: string) => void
  addArtifact: (artifact: Omit<Artifact, 'id' | 'timestamp'>) => Promise<Artifact>
  isRunning: boolean
  setIsRunning: (running: boolean) => void
  generateSummary: () => Promise<string>
  togglePin: (artifactId: number) => Promise<void>
  updateArtifact: (artifact: Artifact) => void
  handleChat: (message?: string) => Promise<boolean>
  selectedStep: string
  setSelectedStep: (step: string) => void
  showAllArtifacts: boolean
  toggleShowAllArtifacts: () => void
}

export const ArtifactContext = createContext<ArtifactContextType | undefined>(undefined)

export const getDefaultViewMode = (artifact: Artifact): ViewMode => {
  console.log('getDefaultViewMode:', {
    hasDataFile: !!artifact.dataFile,
    hasVar2val: !!artifact.var2val,
    var2valKeys: artifact.var2val ? Object.keys(artifact.var2val) : [],
  })

  if (artifact.plotFile) {
    return 'plot'
  } else if (artifact.dataFile || (artifact.var2val && Object.keys(artifact.var2val).length > 0)) {
    return 'data'
  } else {
    return 'output'
  }
}

// Add helper to check if artifact has any data
export const hasData = (artifact: Artifact): boolean => {
  if (!artifact) {
    console.log('hasData: no artifact')
    return false
  }
  const result = !!(artifact.dataFile || (artifact.var2val && Object.keys(artifact.var2val).length > 0))
  console.log('hasData:', {
    result,
    hasDataFile: !!artifact.dataFile,
    hasVar2val: !!artifact.var2val,
    var2valKeys: artifact.var2val ? Object.keys(artifact.var2val) : [],
  })
  return result
}

/**
 * Generates a markdown summary of an artifact's contents
 * @param artifact - The artifact to summarize
 * @param options - Configuration options for the summary
 * @returns A markdown-formatted string summarizing the artifact
 */
export function generateArtifactSummary(
  artifact: Artifact, 
  options: { 
    quoted?: boolean,
    includeData?: boolean,
    includeChat?: boolean,
    includeCode?: boolean,
    includeOutput?: boolean,
    includePlot?: boolean
  } = {}
): string {
  const {
    quoted = false,
    includeData = true,
    includeChat = true,
    includeCode = true,
    includeOutput = true,
    includePlot = true
  } = options

  let artifactSummary = `## Artifact ${getDisplayName(artifact)}`

  if (includeData && artifact.dataFile) {
    artifactSummary += `\n### Data Columns\n${dataHeader(artifact.dataFile)}\n`
  }

  if (includeChat && artifact.chatInput) {
    artifactSummary += `\n### Chat Input\n${artifact.chatInput}\n`
  }

  if (includeCode && artifact.code) {
    artifactSummary += `\n### Code\n\`\`\`python\n${artifact.code}\`\`\`\n`
  }

  if (includeOutput && artifact.output && !artifact.dataFile) {
    const output = artifact.output;
    const truncatedOutput = output.includes('__RESULTS__') 
      ? output.split('__RESULTS__')[0] 
      : output;
    artifactSummary += `\n### Output\n\`\`\`\n${truncatedOutput}\`\`\`\n`
  }

  if (includePlot && artifact.plotFile) {
    artifactSummary += `\n### Plot\n![Plot](${artifact.plotFile})\n`
  }

  if (quoted) {
    artifactSummary = `"""\n${artifactSummary}\n"""\n`
  }

  return artifactSummary
}
