import React, { useEffect, useState } from 'react';
import KnowledgeGraphViewer from './KnowledgeGraphViewer';
import originalSampleData from '../../data/sample-knowledge-graph.json';
import medikanrenData from '../../data/medikanren-knowledge-graph.json';
import { Artifact } from '../../types/artifacts';
import { ArtifactContent } from './ArtifactContent';

const KnowledgeGraphTest: React.FC = () => {
  const [sampleArtifacts, setSampleArtifacts] = useState<{
    original: Artifact | null;
    medikanren: Artifact | null;
  }>({
    original: null,
    medikanren: null
  });

  useEffect(() => {
    // Create a unique ID for the sample artifacts
    const originalId = `test-graph-original-${crypto.randomUUID()}`;
    const medikanrenId = `test-graph-medikanren-${crypto.randomUUID()}`;
    
    // Create sample artifacts for testing
    const originalArtifact: Artifact = {
      id: originalId,
      artifactId: originalId,
      type: 'application/vnd.knowledge-graph',
      title: 'Sample Knowledge Graph',
      content: JSON.stringify(originalSampleData),
      timestamp: new Date(),
      position: 1
    };

    const medikanrenArtifact: Artifact = {
      id: medikanrenId,
      artifactId: medikanrenId,
      type: 'application/vnd.knowledge-graph',
      title: 'MediKanren Knowledge Graph',
      content: JSON.stringify(medikanrenData),
      timestamp: new Date(),
      position: 2
    };
    
    setSampleArtifacts({
      original: originalArtifact,
      medikanren: medikanrenArtifact
    });
  }, []);

  if (!sampleArtifacts.original || !sampleArtifacts.medikanren) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Knowledge Graph Test</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="text-xl font-semibold mb-2">Original Sample Graph</h2>
          <div className="border border-gray-300 rounded-lg p-4 bg-white h-[400px]">
            <KnowledgeGraphViewer data={originalSampleData} />
          </div>
          <div className="mt-2 text-sm text-gray-600">
            <p>Nodes: {originalSampleData.nodes.length}</p>
            <p>Links: {originalSampleData.links.length}</p>
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-2">MediKanren Graph</h2>
          <div className="border border-gray-300 rounded-lg p-4 bg-white h-[400px]">
            <KnowledgeGraphViewer data={medikanrenData} />
          </div>
          <div className="mt-2 text-sm text-gray-600">
            <p>Nodes: {medikanrenData.nodes.length}</p>
            <p>Links: {medikanrenData.links.length}</p>
          </div>
        </div>
      </div>
      
      <div>
        <h2 className="text-xl font-semibold mb-2">ArtifactContent Integration Test</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[500px]">
            <h3 className="text-lg font-medium mb-2">Original Sample</h3>
            <ArtifactContent artifact={sampleArtifacts.original} />
          </div>
          <div className="h-[500px]">
            <h3 className="text-lg font-medium mb-2">MediKanren Data</h3>
            <ArtifactContent artifact={sampleArtifacts.medikanren} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraphTest; 