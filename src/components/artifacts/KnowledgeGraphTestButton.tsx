import React from 'react';
import sampleData from '../../data/sample-knowledge-graph.json';
import { Artifact } from '../../types/artifacts';
import { useChatStore } from '../../store/chatStore';

const KnowledgeGraphTestButton: React.FC = () => {
  const { addArtifact, toggleArtifactWindow, showArtifactWindow } = useChatStore();
  
  const handleTestClick = () => {
    // Create a test artifact
    const testArtifact: Omit<Artifact, 'timestamp'> = {
      id: 'test-knowledge-graph',
      artifactId: 'test-knowledge-graph',
      type: 'application/vnd.knowledge-graph',
      title: 'Sample Knowledge Graph',
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
    <button
      onClick={handleTestClick}
      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
    >
      Knowledge Graph Test
    </button>
  );
};

export default KnowledgeGraphTestButton; 