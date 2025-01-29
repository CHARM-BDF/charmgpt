import { createContext } from 'react'
import { ArtifactContextType } from './ArtifactContext.types'
import { initialArtifactContextValue } from './artifactContextValue'

export const ArtifactContext = createContext<ArtifactContextType>(initialArtifactContextValue) 