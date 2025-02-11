import { ReactNode, useState, useEffect, useCallback } from 'react'
import { ArtifactContext } from './createArtifactContext'
import { Artifact, ViewMode, EditorMode, getDisplayName } from './ArtifactContext.types'

interface ArtifactProviderProps {
  children: ReactNode
}

export function ArtifactProvider({ children }: ArtifactProviderProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('plot')
  const [editorContent, setEditorContent] = useState('')
  const [planContent, setPlanContent] = useState('')
  const [mode, setMode] = useState<EditorMode>('code')
  const [isRunning, setIsRunning] = useState(false)

  // Split artifact loading into a separate function
  const loadPinnedArtifacts = async () => {
    try {
      const response = await fetch('/api/artifacts/pinned')
      if (response.ok) {
        const pinnedArtifacts = await response.json()
        
        // Set initial artifacts to the pinned ones
        setArtifacts(pinnedArtifacts.map((a: Artifact) => ({
          ...a,
          pinned: true  // Ensure they're marked as pinned
        })))
      }
    } catch (error) {
      console.error('Failed to load pinned artifacts:', error)
    }
  }

  // Load pinned artifacts on startup
  useEffect(() => {
    loadPinnedArtifacts()
  }, [])

  // Update addArtifact to check for pinned status
  const addArtifact = (artifact: Omit<Artifact, 'id' | 'timestamp'>) => {
    const newArtifact = {
      ...artifact,
      id: Date.now(),
      timestamp: Date.now(),
      pinned: false  // Start unpinned
    }
    setArtifacts(prev => [...prev, newArtifact])
  }

  const runArtifact = async (code: string, name: string = 'Run Result') => {
    try {
      setIsRunning(true)
      const response = await fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code,
          artifacts  // Send all artifacts
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to run code: ${errorText}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        throw new Error(`Expected JSON response but got: ${text.substring(0, 100)}...`)
      }

      const result = await response.json()

      // Add API prefix to plot and data files if they exist
      const plotFile = result.plotFile ? `/api/data/${result.plotFile}` : undefined
      const dataFile = result.dataFile ? result.dataFile : undefined

      const newArtifact = {
        type: 'code' as const,
        name,
        code,
        output: result.output,
        plotFile,
        dataFile,
        source: 'assistant'
      }

      addArtifact(newArtifact)

      // Set this as the active artifact
      setActiveArtifact({
        ...newArtifact,
        id: artifacts.length,
        timestamp: Date.now()
      })

      // Set the most appropriate view mode based on what's available
      if (plotFile) {
        setViewMode('plot')
      } else if (dataFile) {
        setViewMode('data')
      } else if (result.output) {
        setViewMode('output')
      }

      return result
    } catch (error) {
      console.error('Failed to run code:', error)
      throw error
    } finally {
      setIsRunning(false)
    }
  }

  const generateSummary = async () => {
    // Group artifacts by their display name to get latest versions
    const fileGroups = new Map<string, { artifact: Artifact, timestamp: number }[]>()
    
    for (const artifact of artifacts) {
      if (!artifact.pinned) {
        continue
      }
      if (artifact.dataFile) {
        const displayName = getDisplayName(artifact)
        
        if (!fileGroups.has(displayName)) {
          fileGroups.set(displayName, [])
        }
        fileGroups.get(displayName)!.push({
          artifact,
          timestamp: artifact.timestamp
        })
      }
    }

    const summaries = []
    for (const [displayName, versions] of fileGroups) {
      // Sort by timestamp and get the latest version
      versions.sort((a, b) => b.timestamp - a.timestamp)
      const latest = versions[0].artifact
      
      // Get column info for the latest version
      const response = await fetch(`/api/data/${latest.dataFile}`)
      if (response.ok) {
        const text = await response.text()
        const firstLine = text.split('\n')[0]
        summaries.push(`- ${displayName} with columns ${firstLine}`)
      }
    }

    return summaries.length > 0 
      ? '\nAvailable data files, to be used for plots or tables:\n' + summaries.join('\n')
      : ''
  }

  // Update togglePin to handle persistence
  const togglePin = async (artifactId: number) => {
    const artifact = artifacts.find(a => a.id === artifactId)
    if (!artifact) return

    const newPinnedStatus = !artifact.pinned
    const updatedArtifact = { ...artifact, pinned: newPinnedStatus }

    try {
      const response = await fetch('/api/artifacts/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          artifactId,
          pinned: newPinnedStatus,
          artifact: updatedArtifact
        })
      })

      if (response.ok) {
        // Just update the pin status, don't reload all artifacts
        setArtifacts(prev => prev.map(a => 
          a.id === artifactId ? updatedArtifact : a
        ))
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error)
    }
  }

  const updateArtifact = useCallback((updatedArtifact: Artifact) => {
    setArtifacts(prev => prev.map(art => 
      art.id === updatedArtifact.id ? updatedArtifact : art
    ))
  }, [])

  const value = {
    artifacts,
    activeArtifact,
    viewMode,
    mode,
    setMode,
    setViewMode,
    setActiveArtifact,
    runArtifact,
    editorContent,
    setEditorContent,
    planContent,
    setPlanContent,
    addArtifact,
    isRunning,
    setIsRunning,
    generateSummary,
    togglePin,
    updateArtifact
  }

  return (
    <ArtifactContext.Provider value={value}>
      {children}
    </ArtifactContext.Provider>
  )
} 