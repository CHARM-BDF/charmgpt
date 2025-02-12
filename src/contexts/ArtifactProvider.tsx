import { ReactNode, useState, useEffect, useCallback } from 'react'
import { ArtifactContext } from './createArtifactContext'
import { Artifact, ViewMode, EditorMode, getDisplayName, dataHeader, getDefaultViewMode } from './ArtifactContext.types'
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
  const [selectedStep, setSelectedStep] = useState('')

  // Load pinned artifacts and plan on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load pinned artifacts
        const artifactsResponse = await fetch('/api/artifacts/pinned')
        if (artifactsResponse.ok) {
          const pinnedArtifacts = await artifactsResponse.json()
          setArtifacts(pinnedArtifacts)
        }

        // Load saved plan
        const planResponse = await fetch('/api/artifacts/plan')
        if (planResponse.ok) {
          const { content } = await planResponse.json()
          setPlanContent(content)
        }
      } catch (err) {
        console.error('Failed to load initial data:', err)
      }
    }

    loadInitialData()
  }, [])

  const selectArtifact = useCallback((artifact: Artifact | null) => {
    setActiveArtifact(artifact)
    
    if (artifact) {  // Only set view mode and editor content if we have an artifact
      setViewMode(getDefaultViewMode(artifact))

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
      pinned: false  // Default to unpinned
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
          artifacts: artifacts.filter(a => a.pinned)
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to run code: ${errorText}`)
      }

      const result = await response.json()
      console.log('Run result from server:', result)

      // Add API prefix to plot and data files if they exist
      const plotFile = result.plotFile ? `/api/data/${result.plotFile}` : undefined

      const newArtifact = {
        type: 'code' as const,
        name,
        code,
        output: result.output,
        plotFile,
        dataFile: result.dataFiles?.['final'] || result.dataFile,
        dataFiles: result.dataFiles || {},
        lineNumbers: result.lineNumbers || {},
        source: 'assistant',
        chatInput
      }
      console.log('Created new artifact:', newArtifact)

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
  const togglePin = useCallback(async (artifactId: number) => {
    const artifact = artifacts.find(a => a.id === artifactId)
    if (!artifact) return

    // Update UI state optimistically
    const newPinnedStatus = !artifact.pinned
    setArtifacts(prev => prev.map(a => 
      a.id === artifactId ? { ...a, pinned: newPinnedStatus } : a
    ))

    try {
      const response = await fetch('/api/artifacts/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          artifactId,
          pinned: newPinnedStatus,
          artifact: { ...artifact, pinned: newPinnedStatus }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update pinned status')
      }
    } catch (err) {
      console.error('Failed to toggle pin:', err)
      // Revert UI state on error
      setArtifacts(prev => prev.map(a => 
        a.id === artifactId ? { ...a, pinned: !newPinnedStatus } : a
      ))
    }
  }, [artifacts])

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
      chatInput: input,
      dataFiles: {},  // Add empty dataFiles
      lineNumbers: {}  // Add empty lineNumbers
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
          chatInput: input,
          dataFiles: {},  // Add empty dataFiles
          lineNumbers: {}  // Add empty lineNumbers
        })
      }
    }
  }, [setMode, setEditorContent, runArtifact, addArtifact])

  const handleChat = useCallback(async (message?: string) => {
    if (isRunning) return

    let msg = "";
    if (planContent.trim()) {
      msg = planContent
      // Save to server
      await fetch('/api/artifacts/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: planContent })
      })
    } else {
      msg = await generateSummary()
    }
    if (message) {
      msg = '\n\nGiven:\n' + msg;
      msg += '\n\nAnswer:\n'
      msg += message
    }
    msg = msg.trim()

    console.log("Chat message:", msg);
    try {
      setIsRunning(true)
      const response = await chatWithLLM(msg, {
        provider: 'ollama',
        model: 'qwen2.5'
      })

      // Process response and create artifacts in order
      await parseCodeFromResponse(response, message || '(plan only)\n\n'+msg)
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
    handleChat,
    selectedStep,
    setSelectedStep
  }

  return (
    <ArtifactContext.Provider value={value}>
      {children}
    </ArtifactContext.Provider>
  )
} 