import { ReactNode, useState } from 'react'
import { Artifact } from '../components/ArtifactList'
import { ArtifactContext } from './ArtifactContext.types'

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])

  const addArtifact = (code: string, output: string, type: 'code' | 'visualization', plotFile?: string) => {
    const newArtifact: Artifact = {
      id: Date.now(),
      code,
      output,
      timestamp: new Date(),
      type,
      plotFile
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
      console.log('Run result:', result)

      if (result.plotFile) {
        // Create a new visualization artifact with the plot file
        addArtifact(
          artifact.code,
          result.output,
          'visualization',
          result.plotFile  // Pass the plotFile to the artifact
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