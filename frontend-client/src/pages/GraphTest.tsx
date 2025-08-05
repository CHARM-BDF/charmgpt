import React, { useState } from 'react';
import KnowledgeGraphTestButton from '../components/artifacts/KnowledgeGraphTestButton';
import { useChatStore } from '../store/chatStore';
import { KnowledgeGraphViewer } from '../components/artifacts/KnowledgeGraphViewer';
import { ReagraphKnowledgeGraphViewer } from '../components/artifacts/ReagraphKnowledgeGraphViewer';

const GraphTest: React.FC = () => {
  const { artifacts, selectedArtifactId } = useChatStore();
  const [useReagraph, setUseReagraph] = useState(false);
  
  // Find the selected artifact
  const selectedArtifact = selectedArtifactId 
    ? artifacts.find(a => a.id === selectedArtifactId)
    : null;
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Knowledge Graph Versioning Test</h1>
      
      <div className="mb-4 flex justify-between items-center">
        <KnowledgeGraphTestButton />
        <button 
          className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm font-medium transition-colors"
          onClick={() => setUseReagraph(!useReagraph)}
        >
          {useReagraph ? 'Use Force Graph' : 'Use Reagraph'}
        </button>
      </div>
      
      <div className="border rounded p-4 bg-gray-50 min-h-[600px]">
        {selectedArtifact && selectedArtifact.type === 'application/vnd.ant.knowledge-graph' ? (
          useReagraph ? (
            <div className="w-full h-full overflow-hidden">
              <ReagraphKnowledgeGraphViewer 
                data={selectedArtifact.content}
                artifactId={selectedArtifact.id}
                showVersionControls={true}
              />
            </div>
          ) : (
            <KnowledgeGraphViewer 
              data={selectedArtifact.content}
              artifactId={selectedArtifact.id}
              showVersionControls={true}
            />
          )
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