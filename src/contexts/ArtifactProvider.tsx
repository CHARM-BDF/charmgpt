import { useCallback, useState, ReactNode, useRef } from 'react'
import { ArtifactContext } from './createArtifactContext'
import { Artifact, ArtifactType } from './ArtifactContext.types'
import { API_BASE_URL } from '../config'

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)
  const [editorContent, setEditorContent] = useState<string>('')
  const nextIdRef = useRef(1)

  const generateId = useCallback(() => {
    const id = nextIdRef.current
    nextIdRef.current += 1
    return id
  }, [])

  const addArtifact = useCallback((artifact: Omit<Artifact, 'id' | 'timestamp'>) => {
    const newArtifact: Artifact = {
      ...artifact,
      id: generateId(),
      timestamp: new Date(),
    }
    setArtifacts(prev => [...prev, newArtifact])
    setActiveArtifact(newArtifact)
    
    // Update editor content when adding a code artifact
    if (artifact.type === 'code') {
      setEditorContent(artifact.code)
    }
  }, [generateId])

  const setActiveArtifactWithContent = useCallback((artifact: Artifact | null) => {
    setActiveArtifact(artifact)
    if (artifact?.type === 'code') {
      setEditorContent(artifact.code)
    }
  }, [])

  const runArtifact = useCallback(async (code: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
      }

      const result = await response.json()
     
      if (result.success) {
        // Compare with the last successful run's code
        const isSameCode = code === activeArtifact?.code
     
        if (activeArtifact && isSameCode) {
          const updatedArtifact: Artifact = {
            ...activeArtifact,
            output: result.output || '',
            plotFile: result.plotFile || null,
            type: (result.plotFile ? 'visualization' : 'code') as ArtifactType,
            timestamp: new Date(),
          }
          setArtifacts(prev => prev.map(a => 
            a.id === activeArtifact.id ? updatedArtifact : a
          ))
          setActiveArtifact(updatedArtifact)
        } else {
          const newArtifact: Artifact = {
            id: generateId(),
            type: (result.plotFile ? 'visualization' : 'code') as ArtifactType,
            name: `Run ${new Date().toLocaleTimeString()}`,
            code,
            output: result.output || '',
            plotFile: result.plotFile || null,
            source: 'user',
            timestamp: new Date(),
          }
          setArtifacts(prev => [...prev, newArtifact])
          setActiveArtifact(newArtifact)
          setEditorContent(code)
        }
      } else {
        throw new Error(result.error || 'Unknown error occurred')
      }
    } catch (error) {
      console.error('Error running code:', error)
      const errorArtifact: Artifact = {
        id: generateId(),
        type: 'code' as ArtifactType,
        name: `Error ${new Date().toLocaleTimeString()}`,
        code,
        output: `Error executing code: ${error instanceof Error ? error.message : 'Unknown error'}`,
        plotFile: null,
        source: 'user',
        timestamp: new Date(),
      }
      setArtifacts(prev => [...prev, errorArtifact])
      setActiveArtifact(errorArtifact)
    }
  }, [activeArtifact, generateId])

  const updateEditorContent = useCallback((content: string) => {
    setEditorContent(content)
  }, [])

  return (
    <ArtifactContext.Provider
      value={{
        artifacts,
        activeArtifact,
        setActiveArtifact: setActiveArtifactWithContent,
        runArtifact,
        updateEditorContent,
        editorContent,
        addArtifact,
      }}
    >
      {children}
    </ArtifactContext.Provider>
  )
} 