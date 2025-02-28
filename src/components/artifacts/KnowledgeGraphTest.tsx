import React, { useEffect, useState } from 'react';
import KnowledgeGraphViewer from './KnowledgeGraphViewer';
import sampleData from '../../data/sample-knowledge-graph.json';
import { Artifact } from '../../types/artifacts';
import { ArtifactContent } from './ArtifactContent';

const KnowledgeGraphTest: React.FC = () => {
  const [sampleArtifact, setSampleArtifact] = useState<Artifact | null>(null);

  useEffect(() => {
    // Create a unique ID for the sample artifact
    const uniqueId = `test-knowledge-graph-${crypto.randomUUID()}`;
    
    // Create a sample artifact for testing
    const artifact: Artifact = {
      id: uniqueId,
      artifactId: uniqueId,
      type: 'application/vnd.knowledge-graph',
      title: 'Sample Knowledge Graph',
      content: JSON.stringify(sampleData),
      timestamp: new Date(),
      position: 1
    };
    
    setSampleArtifact(artifact);
  }, []);

  if (!sampleArtifact) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Knowledge Graph Test</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Direct Component Test</h2>
        <div className="border border-gray-300 rounded-lg p-4 bg-white h-[500px]">
          <KnowledgeGraphViewer data={sampleData} />
        </div>
      </div>
      
      <div>
        <h2 className="text-xl font-semibold mb-2">ArtifactContent Integration Test</h2>
        <div className="h-[500px]">
          <ArtifactContent artifact={sampleArtifact} />
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraphTest; 