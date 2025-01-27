import { createContext, useContext, useState, ReactNode } from 'react'
import { Artifact } from '../components/ArtifactList'

interface ArtifactContextType {
  activeArtifact: Artifact | null
  setActiveArtifact: (artifact: Artifact | null) => void
}

const ArtifactContext = createContext<ArtifactContextType | undefined>(undefined)

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)

  return (
    <ArtifactContext.Provider value={{ activeArtifact, setActiveArtifact }}>
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