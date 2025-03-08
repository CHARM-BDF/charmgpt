import { ReactNode, useState, useEffect, useCallback } from 'react'
import { ArtifactContext } from './createArtifactContext'
import { 
  Artifact, 
  ViewMode, 
  EditorMode, 
  CodeLanguage,
  getDisplayName, 
  dataHeader, 
  getDefaultViewMode
} from './ArtifactContext.types'
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

  // Load pinned artifacts and plan on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load pinned artifacts
        const artifactsResponse = await fetch('/api/artifacts/pinned')
        if (artifactsResponse.ok) {
          const pinnedArtifacts = await artifactsResponse.json()
          
          // Only update artifacts if we don't have any yet
          if (artifacts.length === 0) {
            setArtifacts(pinnedArtifacts)
            
            // Set active artifact to last one if none is active
            if (!activeArtifact && pinnedArtifacts.length > 0) {
              selectArtifact(pinnedArtifacts[pinnedArtifacts.length - 1])
            }
          }
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
  }, [artifacts.length, activeArtifact, selectArtifact])

  // Define a type for new artifacts without id and timestamp
  type NewArtifact = Omit<Artifact, 'id' | 'timestamp'> & {
    // These fields are required in the base type but might be undefined in new artifacts
    var2val?: Record<string, { type: string, value: unknown }>,
    var2line?: Record<string, number>,
    var2line_end?: Record<string, number>
  }

  const addArtifact = useCallback((artifact: NewArtifact) => {
    const newArtifact: Artifact = {
      ...artifact,
      id: artifacts.length + 1,
      timestamp: Date.now(),
      var2val: artifact.var2val || {},
      var2line: artifact.var2line || {},
      var2line_end: artifact.var2line_end || {}
    }

    setArtifacts(prev => {
      // Remove any existing artifact with the same name
      const filtered = prev.filter(a => a.name !== artifact.name)
      return [...filtered, newArtifact]
    })

    // Set as active artifact
    setActiveArtifact(newArtifact)
    
    // Set appropriate view mode
    setViewMode(getDefaultViewMode(newArtifact))

    // If it's a plan artifact, switch to plan mode
    // Use type assertion since TypeScript doesn't understand discriminated unions well here
    if ((artifact.type as string) === 'plan') {
      setMode('plan')
    }
  }, [artifacts, setActiveArtifact, setViewMode, setMode])

  const runArtifact = useCallback(async (code: string, language: CodeLanguage = 'python') => {
    try {
      setIsRunning(true)
      const response = await fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code,
          language,
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
      const plotFile = result.plotFile ? `/api/plots/${result.plotFile}` : undefined

      const newArtifact: Artifact = {
        id: artifacts.length + 1,  // Add id
        type: 'code' as const,
        name: `${language} Run Result`,
        code,
        output: result.output,
        plotFile,
        dataFile: result.dataFile,
        source: 'assistant',
        language,
        var2val: result.var2val,
        var2line: result.var2line,
        var2line_end: result.var2line_end,
        timestamp: Date.now()
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
          artifact  // Send the whole artifact, let server handle defaults
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
    // Match both Python and R code blocks
    const codeBlockRegex = /```([Pp]ython|[Rr])\n([\s\S]*?)```/g
    const matches = [...response.matchAll(codeBlockRegex)]
    
    // First create the chat artifact with the processed response
    const processedResponse = response.replace(codeBlockRegex, '[Code added to editor and executed]')
    addArtifact({
      type: 'chat',
      name: `Chat: ${input.slice(0, 30)}...`,
      output: processedResponse,
      chatInput: input,
      var2val: {},
      var2line: {},
      var2line_end: {}
    })
    
    // Then handle any code blocks
    if (matches.length > 0) {
      const artifactName = input.length > 50 ? input.substring(0, 47) + '...' : input
      
      // Process each code block
      for (let i = 0; i < matches.length; i++) {
        const [, language, code] = matches[i]
        const normalizedLanguage = language.toLowerCase() === 'python' ? 'python' : 'r'
        const trimmedCode = code.trim()
        
        // Start new artifact if:
        // 1. It's the first code block, or
        // 2. Code starts with import/library/require
        const isNewBlock = i === 0 || 
          trimmedCode.startsWith('import') || 
          trimmedCode.startsWith('from ') ||
          trimmedCode.startsWith('library(') ||
          trimmedCode.startsWith('require(')

        if (isNewBlock) {
          // Add the chat input as a comment at the top of the code
          const commentStart = normalizedLanguage === 'python' ? '"""' : '#'
          const commentEnd = normalizedLanguage === 'python' ? '"""' : ''
          const codeWithComment = `${commentStart}Query: ${input}\n${commentEnd}\n\n${trimmedCode}`
          
          setMode('code')
          setEditorContent(codeWithComment)
          try {
            await runArtifact(codeWithComment, normalizedLanguage)
          } catch (err) {
            console.error('Failed to run code:', err)
            addArtifact({
              type: 'code',
              name: artifactName + (i > 0 ? ` (${i+1})` : ''),
              code: codeWithComment,
              output: err instanceof Error ? err.message : 'Failed to run code',
              plotFile: undefined,
              dataFile: undefined,
              source: 'assistant',
              chatInput: input,
              language: normalizedLanguage,
              var2val: {},
              var2line: {},
              var2line_end: {}
            })
          }
        } else {
          // Append to existing code
          const newCode = editorContent + '\n\n' + trimmedCode
          setEditorContent(newCode)
        }
      }
    }
  }, [setMode, setEditorContent, runArtifact, addArtifact, editorContent])

  const handleChat = useCallback(async (message?: string): Promise<boolean> => {
    let msg = "";
    if (planContent.trim()) {
      msg = planContent
      // Save to server
      try {
        await fetch('/api/artifacts/plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content: planContent })
        })
      } catch (err) {
        console.error('Failed to save plan:', err)
        return false
      }
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
      const response = await chatWithLLM(msg)

      // Process response and create artifacts in order
      await parseCodeFromResponse(response, message || '(plan only)\n\n'+msg)
      return true
    } catch (err) {
      console.error('Chat error:', err)
      return false
    }
  }, [generateSummary, parseCodeFromResponse, planContent])

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
    setSelectedStep,
  }

  return (
    <ArtifactContext.Provider value={value}>
      {children}
    </ArtifactContext.Provider>
  )
} 
