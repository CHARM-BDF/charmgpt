import React from 'react';
import KnowledgeGraphTestButton from '../components/artifacts/KnowledgeGraphTestButton';
import { useChatStore } from '../store/chatStore';
import KnowledgeGraphViewer from '../components/artifacts/KnowledgeGraphViewer';

const GraphTest: React.FC = () => {
  const { artifacts, selectedArtifactId } = useChatStore();
  
  // Find the selected artifact
  const selectedArtifact = selectedArtifactId 
    ? artifacts.find(a => a.id === selectedArtifactId)
    : null;
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Knowledge Graph Versioning Test</h1>
      
      <div className="mb-4">
        <KnowledgeGraphTestButton />
      </div>
      
      <div className="border rounded p-4 bg-gray-50 min-h-[600px]">
        {selectedArtifact && selectedArtifact.type === 'application/vnd.ant.knowledge-graph' ? (
          <KnowledgeGraphViewer 
            data={selectedArtifact.content}
            artifactId={selectedArtifact.id}
            showVersionControls={true}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            No graph selected. Use the test controls above to create and manipulate a graph.
          </div>
        )}
      </div>
      
      {selectedArtifact && (
        <div className="mt-4 p-4 border rounded bg-white">
          <h2 className="text-lg font-bold mb-2">Selected Artifact Info</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="font-semibold">ID:</div>
            <div>{selectedArtifact.id}</div>
            
            <div className="font-semibold">Title:</div>
            <div>{selectedArtifact.title}</div>
            
            <div className="font-semibold">Version:</div>
            <div>{selectedArtifact.versionNumber || 1}</div>
            
            <div className="font-semibold">Previous Version:</div>
            <div>{selectedArtifact.previousVersionId || 'None'}</div>
            
            <div className="font-semibold">Next Version:</div>
            <div>{selectedArtifact.nextVersionId || 'None'}</div>
            
            {selectedArtifact.graphMetadata && (
              <>
                <div className="font-semibold">Node Count:</div>
                <div>{selectedArtifact.graphMetadata.nodeCount}</div>
                
                <div className="font-semibold">Edge Count:</div>
                <div>{selectedArtifact.graphMetadata.edgeCount}</div>
                
                <div className="font-semibold">Last Command:</div>
                <div>{selectedArtifact.graphMetadata.lastCommand || 'None'}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphTest; 