import { useEffect, useCallback } from 'react'
import { useArtifact } from '../contexts/useArtifact'
import MonacoEditor from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

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

export default function Editor() {
  const { activeArtifact, updateEditorContent, editorContent, mode, artifacts } = useArtifact()

  // Handle mode changes
  useEffect(() => {
    if (mode === 'plan' && (!editorContent || editorContent === DEFAULT_CODE)) {
      updateEditorContent(DEFAULT_PLAN)
    }
  }, [mode, editorContent, updateEditorContent])

  useEffect(() => {
    if (activeArtifact) {
      if (mode === 'plan') {
        const artifactSummary = `
## Artifact ${activeArtifact.id} - ${activeArtifact.name}
\`\`\`python
${activeArtifact.code}
\`\`\`

Output:
\`\`\`
${activeArtifact.output}
\`\`\`
${activeArtifact.plotFile ? `\n![Plot](${activeArtifact.plotFile})\n` : ''}
---
`
        updateEditorContent(editorContent + '\n' + artifactSummary)
      } else {
        updateEditorContent(activeArtifact.code)
      }
    }
  }, [activeArtifact, updateEditorContent, mode])

  const handleEditorDidMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor) => {
    // Add command to expand artifact references
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
      const position = editor.getPosition()
      if (!position) return

      const model = editor.getModel()
      if (!model) return

      const line = model.getLineContent(position.lineNumber)
      const artifactMatch = line.match(/\[\[(\d+)\]\]/)
      
      if (artifactMatch) {
        const artifactId = parseInt(artifactMatch[1])
        const artifact = artifacts.find(a => a.id === artifactId)
        
        if (artifact) {
          const artifactSummary = `
## Artifact ${artifact.id} - ${artifact.name}
\`\`\`python
${artifact.code}
\`\`\`

Output:
\`\`\`
${artifact.output}
\`\`\`
${artifact.plotFile ? `\n![Plot](${artifact.plotFile})\n` : ''}
---
`
          // Replace the [[id]] with the expanded content
          const range = new monaco.Range(
            position.lineNumber,
            line.indexOf('[['),
            position.lineNumber,
            line.indexOf(']]') + 2
          )
          editor.executeEdits('expand-artifact', [{
            range,
            text: artifactSummary,
          }])
        }
      }
    })
  }, [artifacts])

  return (
    <MonacoEditor
      value={editorContent || (mode === 'code' ? DEFAULT_CODE : DEFAULT_PLAN)}
      onChange={value => updateEditorContent(value || '')}
      onMount={handleEditorDidMount}
      height="100%"
      language={mode === 'code' ? 'python' : 'markdown'}
      theme="light"
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: mode === 'plan' ? 'on' : 'off',
        lineNumbers: mode === 'code' ? 'on' : 'off',
      }}
    />
  )
} 