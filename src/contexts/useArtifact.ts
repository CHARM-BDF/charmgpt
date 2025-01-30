import { useContext } from 'react'
import { ArtifactContext } from './createArtifactContext'
import { ArtifactContextType } from './ArtifactContext.types'

export function useArtifact(): ArtifactContextType {
  const context = useContext(ArtifactContext)
  if (!context) {
    throw new Error('useArtifact must be used within an ArtifactProvider')
  }
  
  // Add debug logging
  console.log('useArtifact hook:', { 
    viewMode: context.viewMode,
    setViewMode: !!context.setViewMode 
  })
  
  return context
} 