import { useCallback, useState, ReactNode } from 'react'
import { ArtifactContext } from './createArtifactContext'
import { Artifact, ArtifactType } from './ArtifactContext.types'
import { API_BASE_URL } from '../config'

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)
  const [editorContent, setEditorContent] = useState<string>('')

  const runArtifact = useCallback(async (code: string) => {
    try {
      console.log('Running code:', code)
      console.log('Active artifact code:', activeArtifact?.code)
      console.log('Are they equal?', code === activeArtifact?.code)

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
        // Compare the current code with the active artifact's code
        const isSameCode = code === activeArtifact?.code
        console.log('Is same code?', isSameCode)

        if (activeArtifact && isSameCode) {
          console.log('Updating existing artifact')
          // Update existing artifact with new output
          const updatedArtifact: Artifact = {
            ...activeArtifact,
            output: result.output || '',
            plotFile: result.plotFile || null,
            type: (result.plotFile ? 'visualization' : 'code') as ArtifactType,
            timestamp: new Date(), // Update timestamp to show it was re-run
          }
          setArtifacts(prev => prev.map(a => 
            a.id === activeArtifact.id ? updatedArtifact : a
          ))
          setActiveArtifact(updatedArtifact)
        } else {
          console.log('Creating new artifact')
          // Create new artifact for new or modified code
          const newArtifact: Artifact = {
            id: Date.now(),
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
        }
        // Update editor content after successful run
        setEditorContent(code)
      } else {
        throw new Error(result.error || 'Unknown error occurred')
      }
    } catch (error) {
      console.error('Error running code:', error)
      const errorArtifact: Artifact = {
        id: Date.now(),
        type: 'code' as ArtifactType,
        name: `Error ${new Date().toLocaleTimeString()}`,
        code,
        output: `Error executing code: ${error instanceof Error ? error.message : 'Unknown error'}`,
        plotFile: undefined,
        source: 'user',
        timestamp: new Date(),
      }
      setArtifacts(prev => [...prev, errorArtifact])
      setActiveArtifact(errorArtifact)
    }
  }, [activeArtifact])

  const updateEditorContent = useCallback((content: string) => {
    console.log('Updating editor content:', content)
    setEditorContent(content)
  }, [])

  return (
    <ArtifactContext.Provider
      value={{
        artifacts,
        activeArtifact,
        setActiveArtifact,
        runArtifact,
        updateEditorContent,
        editorContent,
      }}
    >
      {children}
    </ArtifactContext.Provider>
  )
} 