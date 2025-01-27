import { createContext, useContext, useState, ReactNode } from 'react'
import { Artifact } from '../components/ArtifactList'

interface ArtifactContextType {
  activeArtifact: Artifact | null
  setActiveArtifact: (artifact: Artifact | null) => void
  addArtifact: (code: string, output: string, type: 'code' | 'visualization') => void
  artifacts: Artifact[]
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

  return (
    <ArtifactContext.Provider value={{ activeArtifact, setActiveArtifact, addArtifact, artifacts }}>
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