import { useCallback, useState, ReactNode } from 'react'
import { ArtifactContext } from './createArtifactContext'
import { Artifact } from './ArtifactContext.types'
import { API_BASE_URL } from '../config'

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)

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
      console.log('Run result:', result)

      if (result.success) {
        const newArtifact: Artifact = {
          id: Date.now(),
          type: result.plotFile ? 'visualization' : 'code',
          name: `Run ${new Date().toLocaleTimeString()}`,
          code,
          output: result.output || '',
          plotFile: result.plotFile || null,
          source: 'user',
          timestamp: new Date(),
        }

        setArtifacts(prev => [...prev, newArtifact])
        setActiveArtifact(newArtifact)
      } else {
        throw new Error(result.error || 'Unknown error occurred')
      }
    } catch (error) {
      console.error('Error running code:', error)
      const errorArtifact: Artifact = {
        id: Date.now(),
        type: 'code',
        name: `Error ${new Date().toLocaleTimeString()}`,
        code,
        output: `Error executing code: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'user',
        timestamp: new Date(),
      }
      setArtifacts(prev => [...prev, errorArtifact])
      setActiveArtifact(errorArtifact)
    }
  }, [])

  const updateEditorContent = useCallback((content: string) => {
    if (activeArtifact) {
      setActiveArtifact({
        ...activeArtifact,
        code: content,
      })
    }
  }, [activeArtifact])

  return (
    <ArtifactContext.Provider
      value={{
        artifacts,
        activeArtifact,
        setActiveArtifact,
        runArtifact,
        updateEditorContent,
      }}
    >
      {children}
    </ArtifactContext.Provider>
  )
} 