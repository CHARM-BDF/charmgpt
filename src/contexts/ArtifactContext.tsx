import { ReactNode, useState } from 'react'
import { Artifact } from '../components/ArtifactList'
import { ArtifactContext } from './ArtifactContext.types'

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [editorContent, setEditorContent] = useState('')

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
    setEditorContent(code)
  }

  const runArtifact = async (artifact: Artifact) => {
    try {
      // Use the current editor content instead of the artifact's code
      const response = await fetch('http://localhost:3000/api/run-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          code: editorContent,  // Use editor content instead of artifact.code
          timestamp: Date.now() 
        }),
      })

      const result = await response.json()
      console.log('Run result:', result)

      if (result.plotFile) {
        // Create a new visualization artifact with the plot file
        addArtifact(
          editorContent,  // Use editor content
          result.output,
          'visualization',
          result.plotFile
        )
      } else {
        // Update the artifact with new output
        const updatedArtifact = {
          ...artifact,
          code: editorContent,  // Use editor content
          output: result.output,
          timestamp: new Date()
        }
        setArtifacts(prev => prev.map(a => 
          a.id === artifact.id ? updatedArtifact : a
        ))
        setActiveArtifact(updatedArtifact)
      }
    } catch (error) {
      console.error('Failed to run code:', error)
    }
  }

  const updateEditorContent = (content: string) => {
    setEditorContent(content)
  }

  return (
    <ArtifactContext.Provider value={{ 
      activeArtifact, 
      setActiveArtifact, 
      addArtifact, 
      artifacts,
      runArtifact,
      editorContent,
      updateEditorContent 
    }}>
      {children}
    </ArtifactContext.Provider>
  )
} 