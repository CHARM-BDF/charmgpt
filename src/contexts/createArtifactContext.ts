import { createContext } from 'react'
import { ArtifactContextType } from './ArtifactContext.types'
import { artifactContextValue } from './artifactContextValue'

export const ArtifactContext = createContext<ArtifactContextType>(artifactContextValue) 