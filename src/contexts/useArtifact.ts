import { useContext } from 'react'
import { ArtifactContext, ArtifactContextType } from './ArtifactContext.types'

export function useArtifact(): ArtifactContextType {
  const context = useContext(ArtifactContext)
  if (context === undefined) {
    throw new Error('useArtifact must be used within an ArtifactProvider')
  }
  return context
} 