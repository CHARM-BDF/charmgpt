import { ReactNode, useState, useEffect, useCallback } from 'react'
import { ArtifactContext } from './createArtifactContext'
import { Artifact, ViewMode, EditorMode, getDisplayName, dataHeader } from './ArtifactContext.types'
import { chatWithLLM } from '../services/api'

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

  const selectArtifact = useCallback((artifact: Artifact | null) => {
    setActiveArtifact(artifact)

    if (artifact) {  // Only set view mode if we have an artifact
      // Set appropriate view mode based on artifact type
      if (artifact.plotFile) {
        setViewMode('plot')
      } else if (artifact.dataFile) {
        setViewMode('data')
      } else {
        setViewMode('output')
      }

      // If it's a code artifact, also set the editor content
      if (artifact.code && mode === 'code') {
        setEditorContent(artifact.code)
      }
    }
  }, [mode, setEditorContent, setViewMode])

  const addArtifact = useCallback((artifact: Omit<Artifact, 'id' | 'timestamp'>) => {
    const newArtifact = {
      ...artifact,
      id: Date.now(),
      timestamp: Date.now(),
      pinned: false
    }
    setArtifacts(prev => [...prev, newArtifact])
    selectArtifact(newArtifact)
  }, [selectArtifact])

  const runArtifact = useCallback(async (code: string, name: string = 'Run Result', chatInput?: string) => {
    try {
      setIsRunning(true)
      const response = await fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code,
          artifacts
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to run code: ${errorText}`)
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
        source: 'assistant',
        chatInput
      }

      addArtifact(newArtifact)
      return result
    } catch (error) {
      console.error('Failed to run code:', error)
      throw error
    } finally {
      setIsRunning(false)
    }
  }, [artifacts, addArtifact, setIsRunning])

  const generateSummary = useCallback(async () => {
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
      const firstLine = dataHeader(latest.dataFile);
      summaries.push(`- ${displayName} with columns ${firstLine}`)
    }

    return summaries.length > 0 
      ? '\nAvailable data files, to be used for plots or tables:\n' + summaries.join('\n')
      : ''
  }, [artifacts])

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

  const parseCodeFromResponse = useCallback(async (response: string, input: string) => {
    const codeBlockRegex = /```python\n([\s\S]*?)```/g
    const matches = [...response.matchAll(codeBlockRegex)]
    
    // First create the chat artifact with the processed response
    const processedResponse = response.replace(codeBlockRegex, '[Code added to editor and executed]')
    addArtifact({
      type: 'chat',
      name: `Chat: ${input.slice(0, 30)}...`,
      output: processedResponse,
      chatInput: input
    })
    
    // Then handle any code blocks
    if (matches.length > 0) {
      const artifactName = input.length > 50 ? input.substring(0, 47) + '...' : input
      
      // Join all code blocks with newlines between them
      const combinedCode = matches
        .map(match => match[1].trim())
        .join('\n\n')
      
      // Add the chat input as a comment at the top of the code
      const codeWithComment = `"""Query: ${input}\n"""\n\n${combinedCode}`
      
      setMode('code')
      setEditorContent(codeWithComment)
      try {
        await runArtifact(codeWithComment, artifactName, input)
      } catch (err) {
        console.error('Failed to run code:', err)
        addArtifact({
          type: 'code',
          name: artifactName,
          code: codeWithComment,
          output: err instanceof Error ? err.message : 'Failed to run code',
          plotFile: undefined,
          dataFile: undefined,
          source: 'assistant',
          chatInput: input
        })
      }
    }
  }, [setMode, setEditorContent, runArtifact, addArtifact])

  const handleChat = useCallback(async (message?: string) => {
    if (isRunning) return
    
    // Include plan content if it exists

    let msg = "";
    if (planContent.trim()) {
      msg = '\n\nGiven:\n' + planContent
    } else {
      msg = await generateSummary()
    }
    if (msg) {
      msg += '\n\nAnswer:\n'
    }
    msg +=message
    msg = msg.trim()

    try {
      setIsRunning(true)
      const response = await chatWithLLM(msg, {
        provider: 'ollama',
        model: 'qwen2.5'
      })

      // Process response and create artifacts in order
      await parseCodeFromResponse(response, message || '(plan)')
    } catch (err) {
      console.error('Chat error:', err)
    } finally {
      setIsRunning(false)
    }
  }, [generateSummary, isRunning, parseCodeFromResponse, setIsRunning, planContent])

  const value = {
    artifacts,
    activeArtifact,
    viewMode,
    mode,
    setMode,
    setViewMode,
    setActiveArtifact: selectArtifact,
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
    updateArtifact,
    handleChat
  }

  return (
    <ArtifactContext.Provider value={value}>
      {children}
    </ArtifactContext.Provider>
  )
} 