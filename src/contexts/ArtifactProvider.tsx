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
  const [allArtifacts, setAllArtifacts] = useState<Artifact[]>([])
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('plot')
  const [editorContent, setEditorContent] = useState('')
  const [planContent, setPlanContent] = useState('')
  const [pipeContent, setPipeContent] = useState('')
  const [mode, setMode] = useState<EditorMode>('code')
  const [isRunning, setIsRunning] = useState(false)
  const [selectedStep, setSelectedStep] = useState('')
  const [showAllArtifacts, setShowAllArtifacts] = useState(false)
  // Track artifacts created in the current session
  const [currentSessionArtifacts, setCurrentSessionArtifacts] = useState<Set<number>>(new Set())

  const selectArtifact = useCallback((artifact: Artifact | null) => {
    setActiveArtifact(artifact)
    
    if (artifact) {
      if ((artifact.type as string) === 'plan' && 'content' in artifact) {
        // For plan artifacts, switch to plan mode and load content immediately
        setMode('plan')
        
        // Set the plan content from the artifact
        const planContent = artifact.content as string;
        setPlanContent(planContent);
        
        // Also save to backend to ensure consistency
        const savePlanToBackend = async () => {
          try {
            await fetch('/api/artifacts/plan', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ content: planContent })
            });
          } catch (err) {
            console.error('Failed to save plan to backend:', err);
          }
        };
        savePlanToBackend();
      } else if ((artifact.type as string) === 'pipe' && 'content' in artifact) {
        // For pipe artifacts, switch to pipe mode and load content immediately
        setMode('pipe')
        
        // Set the pipe content from the artifact
        const pipeContent = artifact.content as string;
        setPipeContent(pipeContent);
        
        // Also save to backend to ensure consistency
        const savePipeToBackend = async () => {
          try {
            await fetch('/api/artifacts/pipe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ content: pipeContent })
            });
          } catch (err) {
            console.error('Failed to save pipe to backend:', err);
          }
        };
        savePipeToBackend();
      } else if ((artifact.type as string) === 'code') {
        // For code artifacts, use default behavior
        setViewMode(getDefaultViewMode(artifact))

        // If we're in code mode, set the editor content
        if (mode === 'code') {
          setEditorContent(artifact.code as string)
        }
      } else {
        // For other artifacts (chat), just set view mode
        setViewMode(getDefaultViewMode(artifact))
      }
    }
  }, [mode, setEditorContent, setPlanContent, setMode, setViewMode])

  // Load all artifacts on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load all artifacts
        const allArtifactsResponse = await fetch('/api/artifacts/all')
        
        if (allArtifactsResponse.ok) {
          const loadedAllArtifacts = await allArtifactsResponse.json()
          
          // Store all artifacts
          setAllArtifacts(loadedAllArtifacts)
          
          // Filter for display based on showAllArtifacts
          const displayArtifacts = showAllArtifacts 
            ? loadedAllArtifacts 
            : loadedAllArtifacts.filter((a: Artifact) => a.pinned);
          
          setArtifacts(displayArtifacts)
          
          // Set active artifact to last one if none is active
          if (!activeArtifact && displayArtifacts.length > 0) {
            selectArtifact(displayArtifacts[displayArtifacts.length - 1])
          }
        }

        // Load saved plan
        const planResponse = await fetch('/api/artifacts/plan')
        if (planResponse.ok) {
          const { content } = await planResponse.json()
          setPlanContent(content)
        }

        // Load saved pipe
        const pipeResponse = await fetch('/api/artifacts/pipe')
        if (pipeResponse.ok) {
          const { content } = await pipeResponse.json()
          setPipeContent(content)
        }
      } catch (err) {
        console.error('Failed to load initial data:', err)
      }
    }

    loadInitialData()
  }, [activeArtifact, selectArtifact, showAllArtifacts])

  // Update displayed artifacts when showAllArtifacts changes
  useEffect(() => {
    if (allArtifacts.length > 0) {
      const displayArtifacts = showAllArtifacts 
        ? allArtifacts 
        : allArtifacts.filter(a => a.pinned || currentSessionArtifacts.has(a.id));
      
      setArtifacts(displayArtifacts)
      
      // If active artifact is not in the filtered list, select the most recent one
      if (activeArtifact && !displayArtifacts.some(a => a.id === activeArtifact.id) && displayArtifacts.length > 0) {
        // Sort by timestamp descending and select the first one
        const sortedArtifacts = [...displayArtifacts].sort((a, b) => b.timestamp - a.timestamp);
        selectArtifact(sortedArtifacts[0]);
      }
    }
  }, [showAllArtifacts, allArtifacts, activeArtifact, selectArtifact, currentSessionArtifacts])

  // Define a type for new artifacts without id and timestamp
  type NewArtifact = Omit<Artifact, 'id' | 'timestamp'> & {
    // These fields are required in the base type but might be undefined in new artifacts
    var2val?: Record<string, { type: string, value: unknown }>,
    var2line?: Record<string, number>,
    var2line_end?: Record<string, number>,
    // Optional fields for parent-child relationships
    parentId?: number,
    blockIndex?: number
  }

  const generateUniqueId = useCallback((options?: { parentId?: number, blockIndex?: number }) => {
    if (options?.parentId && options?.blockIndex) {
        return options.parentId + options.blockIndex;
    }
    
    return Date.now() * 1000;
  }, []);

  // Add a function to ensure the artifacts list shows pinned artifacts and current session artifacts
  const ensureCorrectArtifactsDisplayed = useCallback(() => {
    if (!showAllArtifacts && allArtifacts.length > 0) {
      // When in "Pinned Only" mode, show pinned artifacts and current session artifacts
      const filteredArtifacts = allArtifacts.filter(a => a.pinned || currentSessionArtifacts.has(a.id));
      setArtifacts(filteredArtifacts);
    }
  }, [showAllArtifacts, allArtifacts, currentSessionArtifacts]);

  // Add toggleShowAllArtifacts function
  const toggleShowAllArtifacts = useCallback(() => {
    setShowAllArtifacts(prev => !prev);
  }, []);

  const addArtifact = useCallback(async (artifact: NewArtifact): Promise<Artifact> => {
    // If it's a plan artifact, save the content to the backend first
    if ((artifact.type as string) === 'plan' && 'content' in artifact) {
      try {
        const planContent = artifact.content as string;
        
        // Save plan content to backend
        await fetch('/api/artifacts/plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content: planContent })
        });
        
        // Update local plan content state
        setPlanContent(planContent);
      } catch (err) {
        console.error('Failed to save plan to backend:', err);
      }
    }

    // Generate a unique ID and timestamp for the new artifact
    const uniqueId = generateUniqueId({
      parentId: artifact.parentId,
      blockIndex: artifact.blockIndex
    });
    const currentTimestamp = Date.now();

    const newArtifact: Artifact = {
      ...artifact,
      id: uniqueId,
      timestamp: currentTimestamp,
      var2val: artifact.var2val || {},
      var2line: artifact.var2line || {},
      var2line_end: artifact.var2line_end || {}
    }

    // Check if this artifact already exists in allArtifacts (by ID)
    const artifactExists = allArtifacts.some(a => a.id === newArtifact.id);
    
    if (!artifactExists) {
      // Add to UI state - both allArtifacts and filtered artifacts
      setAllArtifacts(prev => [...prev, newArtifact]);
      
      // Add to current session artifacts
      setCurrentSessionArtifacts(prev => {
        const newSet = new Set(prev);
        newSet.add(newArtifact.id);
        return newSet;
      });
      
      // Add to visible artifacts
      setArtifacts(prev => [...prev, newArtifact]);
    } else {
      console.log(`Artifact with ID ${newArtifact.id} already exists, not adding duplicate`);
      
      // Ensure the artifacts list is correctly filtered
      ensureCorrectArtifactsDisplayed();
    }

    // Set as active artifact
    setActiveArtifact(newArtifact)
    
    // Set appropriate view mode
    setViewMode(getDefaultViewMode(newArtifact))

    // If it's a plan artifact, switch to plan mode
    if ((artifact.type as string) === 'plan') {
      setMode('plan')
    }

    // Save to backend if it's a pinned artifact
    try {
      if (newArtifact.pinned) {
        // Save to pinned artifacts
        await fetch('/api/artifacts/pin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            artifactId: newArtifact.id,
            pinned: true,
            artifact: newArtifact
          })
        });
      } else {
        // Save to all artifacts
        await fetch('/api/artifacts/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            artifact: newArtifact
          })
        });
      }
    } catch (err) {
      console.error('Failed to save artifact:', err);
    }
    
    // Return the new artifact for chaining
    return newArtifact;
  }, [generateUniqueId, setActiveArtifact, setViewMode, setMode, setPlanContent, allArtifacts, ensureCorrectArtifactsDisplayed])

  const runArtifact = useCallback(async (
    code: string, 
    language: CodeLanguage = 'python',
    options?: { parentId?: number, blockIndex?: number }
  ) => {
    // Don't run if already running
    if (isRunning) return
    
    setIsRunning(true)
    
    try {
      // Check if we're running the exact same code as the current artifact
      const isIdenticalToActive = 
        activeArtifact && 
        (activeArtifact.type as string) === 'code' && 
        activeArtifact.code === code &&
        activeArtifact.language === language;
      
      console.log('Code comparison:', {
        isIdenticalToActive,
        activeCode: activeArtifact?.code,
        newCode: code,
        activeLanguage: activeArtifact?.language,
        newLanguage: language
      });
      
      // Run the code first to get the results
      const response = await fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code,
          language
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
      const plotFiles = result.plotFiles ? result.plotFiles.map((file: string) => `/api/plots/${file}`) : undefined
      
      // If identical, update the existing artifact
      if (isIdenticalToActive) {
        console.log('Running identical code, updating existing artifact');
        
        // Update the existing artifact with new results and update timestamp
        const currentTime = Date.now();
        
        // Create updated artifact with new results
        const updatedArtifact = {
          ...activeArtifact,
          output: result.output,
          plotFile,
          plotFiles,
          dataFile: result.dataFile,
          var2val: result.var2val || {},
          var2line: result.var2line || {},
          var2line_end: result.var2line_end || {},
          timestamp: currentTime // Update timestamp to current time
        };
        
        // Update allArtifacts list
        setAllArtifacts(prev => {
          return prev.map(a => {
            if (a.id === activeArtifact.id) {
              return updatedArtifact;
            }
            return a;
          });
        });
        
        // Update filtered artifacts list
        if (showAllArtifacts || updatedArtifact.pinned) {
          setArtifacts(prev => {
            return prev.map(a => {
              if (a.id === activeArtifact.id) {
                return updatedArtifact;
              }
              return a;
            });
          });
        } else {
          // If it's unpinned and we're in pinned-only mode, it shouldn't be in the filtered list
          setArtifacts(prev => prev.filter(a => a.id !== activeArtifact.id));
        }
        
        // Also update the active artifact reference
        setActiveArtifact(updatedArtifact);
        
        // Set the appropriate view mode based on the updated artifact
        setViewMode(getDefaultViewMode(updatedArtifact));
        
        // Save to backend
        try {
          if (activeArtifact.pinned) {
            // Save to pinned artifacts
            fetch('/api/artifacts/pin', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                artifactId: updatedArtifact.id,
                pinned: true,
                artifact: updatedArtifact
              })
            }).catch(err => {
              console.error('Failed to update pinned artifact:', err);
            });
          } else {
            // Save to all artifacts
            fetch('/api/artifacts/save', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                artifact: updatedArtifact
              })
            }).catch(err => {
              console.error('Failed to save to all artifacts:', err);
            });
          }
        } catch (err) {
          console.error('Failed to save artifact:', err);
        }
      } else {
        console.log('Running new code, creating new artifact');
        
        // Create a name based on the first line of code or timestamp
        const firstLine = code.split('\n')[0].trim()
        const artifactName = firstLine 
          ? firstLine.substring(0, 30) + (firstLine.length > 30 ? '...' : '')
          : `Code ${new Date().toLocaleTimeString()}`
        
        // Create a new artifact
        const newArtifact: NewArtifact = {
          type: 'code',
          name: artifactName,
          code,
          output: result.output,
          plotFile,
          plotFiles,
          dataFile: result.dataFile,
          language,
          var2val: result.var2val || {},
          var2line: result.var2line || {},
          var2line_end: result.var2line_end || {},
          source: 'user',
          // Add parent-child relationship if provided
          parentId: options?.parentId,
          blockIndex: options?.blockIndex
        }
        
        // Add the new artifact
        await addArtifact(newArtifact)
      }
    } catch (error) {
      console.error('Error running code:', error)
    } finally {
      setIsRunning(false)
    }
  }, [isRunning, activeArtifact, addArtifact, showAllArtifacts, setViewMode])

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

  // Update togglePin to handle in-memory filtering
  const togglePin = useCallback(async (artifactId: number) => {
    const artifact = allArtifacts.find(a => a.id === artifactId)
    if (!artifact) return

    // Update UI state optimistically
    const newPinnedStatus = !artifact.pinned
    
    // Create a copy of the artifact with the updated pinned status
    const updatedArtifact = {
      ...artifact,
      pinned: newPinnedStatus
    };
    
    // Update the allArtifacts list
    setAllArtifacts(prev => prev.map(a => 
      a.id === artifactId ? updatedArtifact : a
    ));
    
    // Update the filtered artifacts list
    if (showAllArtifacts) {
      // If showing all, just update the artifact
      setArtifacts(prev => prev.map(a => 
        a.id === artifactId ? updatedArtifact : a
      ));
    } else {
      // If showing only pinned, remove unpinned artifacts
      if (newPinnedStatus) {
        // If newly pinned, make sure it's in the list
        setArtifacts(prev => {
          if (prev.some(a => a.id === artifactId)) {
            return prev.map(a => a.id === artifactId ? updatedArtifact : a);
          } else {
            return [...prev, updatedArtifact];
          }
        });
      } else {
        // If unpinned, remove from the list
        setArtifacts(prev => prev.filter(a => a.id !== artifactId));
      }
    }
    
    // Also update activeArtifact if it's the same artifact
    if (activeArtifact && activeArtifact.id === artifactId) {
      setActiveArtifact(updatedArtifact);
    }

    try {
      const response = await fetch('/api/artifacts/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          artifactId,
          pinned: newPinnedStatus,
          artifact: updatedArtifact
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update pinned status')
      }
    } catch (err) {
      console.error('Failed to toggle pin:', err)
      // Revert UI state on error
      const revertedArtifact = {
        ...updatedArtifact,
        pinned: !newPinnedStatus
      };
      
      // Revert allArtifacts
      setAllArtifacts(prev => prev.map(a => 
        a.id === artifactId ? revertedArtifact : a
      ));
      
      // Revert filtered artifacts
      if (showAllArtifacts) {
        setArtifacts(prev => prev.map(a => 
          a.id === artifactId ? revertedArtifact : a
        ));
      } else {
        if (!newPinnedStatus) {
          // If we were unpinning, add it back
          setArtifacts(prev => {
            if (prev.some(a => a.id === artifactId)) {
              return prev.map(a => a.id === artifactId ? revertedArtifact : a);
            } else {
              return [...prev, revertedArtifact];
            }
          });
        } else {
          // If we were pinning, remove it
          setArtifacts(prev => prev.filter(a => a.id !== artifactId));
        }
      }
      
      // Also revert activeArtifact if it's the same artifact
      if (activeArtifact && activeArtifact.id === artifactId) {
        setActiveArtifact(revertedArtifact);
      }
    }
  }, [allArtifacts, showAllArtifacts, activeArtifact]);

  // Update updateArtifact to handle in-memory filtering
  const updateArtifact = useCallback(async (updatedArtifact: Artifact) => {
    // Update in allArtifacts state
    setAllArtifacts(prev => prev.map(art => 
      art.id === updatedArtifact.id ? updatedArtifact : art
    ));
    
    // Update in filtered artifacts state
    if (showAllArtifacts || updatedArtifact.pinned) {
      setArtifacts(prev => prev.map(art => 
        art.id === updatedArtifact.id ? updatedArtifact : art
      ));
    } else {
      // If it's unpinned and we're in pinned-only mode, remove it
      setArtifacts(prev => prev.filter(art => art.id !== updatedArtifact.id));
    }
    
    // Also update activeArtifact if it's the same artifact
    if (activeArtifact && activeArtifact.id === updatedArtifact.id) {
      setActiveArtifact(updatedArtifact);
      
      // Set the appropriate view mode based on the updated artifact
      setViewMode(getDefaultViewMode(updatedArtifact));
    }
    
    // Save to backend
    try {
      if (updatedArtifact.pinned) {
        // Save to pinned artifacts
        await fetch('/api/artifacts/pin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            artifactId: updatedArtifact.id,
            pinned: true,
            artifact: updatedArtifact
          })
        });
      } else {
        // Save to all artifacts
        await fetch('/api/artifacts/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            artifact: updatedArtifact
          })
        });
      }
    } catch (err) {
      console.error('Failed to save updated artifact to backend:', err);
    }
  }, [activeArtifact, setViewMode, showAllArtifacts]);

  const parseCodeFromResponse = useCallback(async (response: string, input: string) => {
    // Match both Python and R code blocks
    const codeBlockRegex = /```([Pp]ython|[Rr])\n([\s\S]*?)```/g
    const matches = [...response.matchAll(codeBlockRegex)]
    
    // First create the chat artifact with the processed response
    const processedResponse = `Query: ${input}\n\n${response}`//response.replace(codeBlockRegex, '[Code added to editor and executed]')
    const chatArtifact = await addArtifact({
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
            // Run the code and create a new artifact
            // The runArtifact function will handle creating the artifact with the appropriate ID
            await runArtifact(codeWithComment, normalizedLanguage, {
              parentId: chatArtifact.id,
              blockIndex: i + 1  // 1-based index for the code block
            })
          } catch (err) {
            console.error('Failed to run code:', err)
            await addArtifact({
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
              var2line_end: {},
              parentId: chatArtifact.id,
              blockIndex: i + 1  // 1-based index for the code block
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

  const handleChat = useCallback(async (message?: string, docString?: string): Promise<boolean> => {
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
      await parseCodeFromResponse(response, docString || '(plan only)\n\n'+msg)
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
    pipeContent,
    setPipeContent,
    addArtifact,
    isRunning,
    setIsRunning,
    generateSummary,
    togglePin,
    updateArtifact,
    handleChat,
    selectedStep,
    setSelectedStep,
    showAllArtifacts,
    toggleShowAllArtifacts
  }

  return (
    <ArtifactContext.Provider value={value}>
      {children}
    </ArtifactContext.Provider>
  )
} 
