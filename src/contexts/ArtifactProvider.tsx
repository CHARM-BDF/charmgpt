import { ReactNode, useState } from 'react'
import { ArtifactContext } from './createArtifactContext'
import { Artifact, ViewMode, EditorMode } from './ArtifactContext.types'

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

  const addArtifact = (artifact: Omit<Artifact, 'id' | 'timestamp'>) => {
    const newArtifact = {
      ...artifact,
      id: Date.now(),
      timestamp: Date.now()
    }
    setArtifacts(prev => [...prev, newArtifact])
  }

  const runArtifact = async (code: string) => {
    try {
      console.log('Starting runArtifact with code:', code)
      
      const response = await fetch('/api/run-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      })

      console.log('API Response status:', response.status)
      const responseText = await response.text()
      console.log('API Response text:', responseText)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, body: ${responseText}`)
      }

      let result
      try {
        result = JSON.parse(responseText)
      } catch (e) {
        console.error('Failed to parse response as JSON:', e)
        throw new Error('Invalid response format from server')
      }

      console.log('Parsed result:', result)

      const timestamp = new Date().toLocaleTimeString()
      const name = `Run Result (${timestamp})`

      console.log('Creating new artifact with name:', name)

      const newArtifact = {
        name,
        output: result.output || '',
        plotFile: result.plotFile,
        dataFile: result.dataFile,
        type: 'visualization' as const,
        code
      }

      console.log('New artifact:', newArtifact)

      // Add the new artifact
      addArtifact(newArtifact)

      // Set it as active after adding it
      setArtifacts(prevArtifacts => {
        console.log('Previous artifacts:', prevArtifacts)
        const latest = prevArtifacts[prevArtifacts.length - 1]
        if (latest) {
          console.log('Setting active artifact:', latest)
          setActiveArtifact(latest)
        }
        return prevArtifacts
      })

    } catch (error) {
      console.error('Error in runArtifact:', error)
      const timestamp = new Date().toLocaleTimeString()
      const errorArtifact = {
        name: `Error (${timestamp})`,
        output: error instanceof Error ? error.message : 'Unknown error',
        type: 'visualization' as const,
        code
      }
      console.log('Adding error artifact:', errorArtifact)
      addArtifact(errorArtifact)
    }
  }

  return (
    <ArtifactContext.Provider
      value={{
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
        addArtifact,
        planContent,
        setPlanContent,
      }}
    >
      {children}
    </ArtifactContext.Provider>
  )
} 