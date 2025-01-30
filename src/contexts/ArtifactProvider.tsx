import { useCallback, useState, ReactNode } from 'react'
import { ArtifactContext } from './createArtifactContext'
import { Artifact, EditorMode, ViewMode } from './ArtifactContext.types'
import { API_BASE_URL } from '../config'

const DEFAULT_CODE = `# Start coding here
import pandas as pd
import numpy as np

# Your data science code goes here
print("Hello, world!")`

const DEFAULT_PLAN = `# Analysis Plan

## Objective
- What questions are we trying to answer?
- What insights are we looking for?

## Analysis History
Click on an artifact from the history panel to insert it here.
Use [[artifact-id]] syntax to reference artifacts.

## Next Steps
1. 
2. 
3. 

## Notes & Questions
- 

## References
- 
`

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null)
  const [editorContent, setEditorContent] = useState<string>(DEFAULT_CODE)
  const [planContent, setPlanContent] = useState<string>(DEFAULT_PLAN)
  const [mode, setMode] = useState<EditorMode>('code')
  const [viewMode, setViewMode] = useState<ViewMode>('plot')

  const addArtifact = useCallback((artifact: Omit<Artifact, 'id' | 'timestamp'>) => {
    const newArtifact: Artifact = {
      ...artifact,
      id: Date.now(),
      timestamp: Date.now(),
    }
    setArtifacts(prev => [...prev, newArtifact])
    setActiveArtifact(newArtifact)
    if (artifact.type === 'code') {
      setEditorContent(artifact.code)
    }
  }, [])

  const runArtifact = useCallback(async (code: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/run-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
      }

      const result = await response.json()
     
      if (result.success) {
        const isSameCode = code === activeArtifact?.code
     
        if (activeArtifact && isSameCode) {
          const updatedArtifact: Artifact = {
            ...activeArtifact,
            output: result.output || '',
            plotFile: result.plotFile || undefined,
            dataFile: result.dataFile || undefined,
            type: result.plotFile ? 'visualization' : 'code',
            timestamp: Date.now(),
          }
          setArtifacts(prev => prev.map(a => 
            a.id === activeArtifact.id ? updatedArtifact : a
          ))
          setActiveArtifact(updatedArtifact)
        } else {
          const newArtifact: Artifact = {
            id: Date.now(),
            type: result.plotFile ? 'visualization' : 'code',
            name: `Run ${new Date().toLocaleTimeString()}`,
            code,
            output: result.output || '',
            plotFile: result.plotFile || undefined,
            dataFile: result.dataFile || undefined,
            timestamp: Date.now(),
            source: 'user'
          }
          setArtifacts(prev => [...prev, newArtifact])
          setActiveArtifact(newArtifact)
          setEditorContent(code)
        }
      } else {
        throw new Error(result.error || 'Unknown error occurred')
      }
    } catch (error) {
      console.error('Error running code:', error)
      const errorArtifact: Artifact = {
        id: Date.now(),
        type: 'code',
        name: `Error ${new Date().toLocaleTimeString()}`,
        code,
        output: `Error executing code: ${error instanceof Error ? error.message : 'Unknown error'}`,
        plotFile: undefined,
        dataFile: undefined,
        timestamp: Date.now(),
        source: 'user'
      }
      setArtifacts(prev => [...prev, errorArtifact])
      setActiveArtifact(errorArtifact)
    }
  }, [activeArtifact])

  const updateEditorContent = useCallback((content: string) => {
    setEditorContent(content)
  }, [])

  const updatePlanContent = useCallback((content: string) => {
    setPlanContent(content)
  }, [])

  return (
    <ArtifactContext.Provider
      value={{
        artifacts,
        activeArtifact,
        setActiveArtifact,
        runArtifact,
        editorContent,
        setEditorContent,
        planContent,
        setPlanContent,
        updateEditorContent,
        updatePlanContent,
        addArtifact,
        mode,
        setMode,
        viewMode,
        setViewMode,
      }}
    >
      {children}
    </ArtifactContext.Provider>
  )
} 