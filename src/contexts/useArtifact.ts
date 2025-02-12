import { useContext } from 'react'
import { ArtifactContext } from './createArtifactContext'
import { ArtifactContextType } from './ArtifactContext.types'

export function useArtifact(): ArtifactContextType {
  const context = useContext(ArtifactContext)
  if (!context) {
    throw new Error('useArtifact must be used within an ArtifactProvider')
  }
  
  return context
} 