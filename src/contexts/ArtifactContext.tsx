import { ReactNode, useState } from 'react'
import { Artifact, ArtifactContext, ArtifactSource, ArtifactType } from './ArtifactContext.types'

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [editorContent, setEditorContent] = useState('')

  const addArtifact = (
    code: string,
    name: string,
    type: ArtifactType,
    options?: {
      parentId?: number
      source?: ArtifactSource
      description?: string
      output?: string
      plotFile?: string
    }
  ): Artifact => {
    const newArtifact: Artifact = {
      id: Date.now(),
      code,
      output: options?.output || '',
      timestamp: new Date(),
      type,
      plotFile: options?.plotFile,
      name,
      parentId: options?.parentId || activeArtifact?.id,
      source: options?.source || 'user',
      description: options?.description
    }
    
    setArtifacts(prev => [...prev, newArtifact])
    setActiveArtifact(newArtifact)
    setEditorContent(code)
    
    return newArtifact
  }

  const runArtifact = async (artifact: Artifact) => {
    try {
      const response = await fetch('http://localhost:3000/api/run-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          code: artifact.code,
          timestamp: Date.now() 
        }),
      })

      const result = await response.json()
      console.log('Run result:', result)

      if (result.plotFile) {
        return addArtifact(
          artifact.code,
          'Visualization Result',
          'visualization',
          {
            parentId: artifact.id,
            source: 'user',
            output: result.output,
            plotFile: result.plotFile,
            description: 'Generated visualization'
          }
        )
      } else {
        return addArtifact(
          artifact.code,
          'Code Result',
          'code',
          {
            parentId: artifact.id,
            source: 'user',
            output: result.output,
            description: 'Code execution result'
          }
        )
      }
    } catch (error) {
      console.error('Failed to run code:', error)
      return addArtifact(
        artifact.code,
        'Failed Execution',
        'code',
        {
          parentId: artifact.id,
          source: 'user',
          output: `Error: ${error}`,
          description: 'Failed to execute code'
        }
      )
    }
  }

  const updateEditorContent = (content: string) => {
    setEditorContent(content)
  }

  return (
    <ArtifactContext.Provider value={{ 
      activeArtifact,
      setActiveArtifact,
      artifacts,
      runArtifact,
      editorContent,
      updateEditorContent,
      addArtifact
    }}>
      {children}
    </ArtifactContext.Provider>
  )
} 