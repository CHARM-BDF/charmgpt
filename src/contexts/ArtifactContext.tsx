import { createContext, useContext, useState, ReactNode } from 'react'
import { Artifact } from '../components/ArtifactList'

interface ArtifactContextType {
  activeArtifact: Artifact | null
  setActiveArtifact: (artifact: Artifact | null) => void
  addArtifact: (code: string, output: string, type: 'code' | 'visualization') => void
  artifacts: Artifact[]
  runArtifact: (artifact: Artifact) => Promise<void>
}

const ArtifactContext = createContext<ArtifactContextType | undefined>(undefined)

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])

  const addArtifact = (code: string, output: string, type: 'code' | 'visualization') => {
    const newArtifact: Artifact = {
      id: Date.now(), // Simple way to generate unique IDs
      code,
      output,
      timestamp: new Date(),
      type
    }
    setArtifacts(prev => [...prev, newArtifact])
    setActiveArtifact(newArtifact)
  }

  const runArtifact = async (artifact: Artifact) => {
    try {
      const response = await fetch('http://localhost:3000/api/run-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: artifact.code }),
      })

      const result = await response.json()

      if (result.visualization) {
        // Create a new visualization artifact
        addArtifact(
          artifact.code,
          result.visualization,
          'visualization'
        )
      } else {
        // Update the artifact with new output
        const updatedArtifact = {
          ...artifact,
          output: result.output,
        }
        setArtifacts(prev => prev.map(a => 
          a.id === artifact.id ? updatedArtifact : a
        ))
      }
    } catch (error) {
      console.error('Failed to run code:', error)
    }
  }

  return (
    <ArtifactContext.Provider value={{ 
      activeArtifact, 
      setActiveArtifact, 
      addArtifact, 
      artifacts,
      runArtifact 
    }}>
      {children}
    </ArtifactContext.Provider>
  )
}

export function useArtifact() {
  const context = useContext(ArtifactContext)
  if (context === undefined) {
    throw new Error('useArtifact must be used within an ArtifactProvider')
  }
  return context
} 