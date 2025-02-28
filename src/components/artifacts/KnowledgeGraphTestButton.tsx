import React from 'react';
import originalSampleData from '../../data/sample-knowledge-graph.json';
import medikanrenData from '../../data/medikanren-knowledge-graph.json';
import { Artifact } from '../../types/artifacts';
import { useChatStore } from '../../store/chatStore';

const KnowledgeGraphTestButton: React.FC = () => {
  const { addArtifact, toggleArtifactWindow, showArtifactWindow } = useChatStore();
  
  const handleTestClick = (dataSource: 'sample' | 'medikanren') => {
    // Determine which data to use
    const sampleData = dataSource === 'sample' ? originalSampleData : medikanrenData;
    const title = dataSource === 'sample' ? 'Sample Knowledge Graph' : 'MediKanren Knowledge Graph';
    
    // Create a unique ID for the test artifact
    const uniqueId = `test-knowledge-graph-${crypto.randomUUID()}`;
    
    // Create a test artifact
    const testArtifact: Omit<Artifact, 'timestamp'> = {
      id: uniqueId,
      artifactId: uniqueId,
      type: 'application/vnd.knowledge-graph',
      title,
      content: JSON.stringify(sampleData),
      position: 1
    };
    
    // Add the artifact to the store
    addArtifact(testArtifact);
    
    // Make sure the artifact window is visible
    if (!showArtifactWindow) {
      toggleArtifactWindow();
    }
  };

  return (
    <div className="flex flex-col space-y-1">
      <button
        onClick={() => handleTestClick('sample')}
        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
      >
        Sample Knowledge Graph
      </button>
      <button
        onClick={() => handleTestClick('medikanren')}
        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
      >
        MediKanren Knowledge Graph
      </button>
    </div>
  );
};

export default KnowledgeGraphTestButton; 