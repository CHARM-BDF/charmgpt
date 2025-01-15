import React from 'react';
import { useChatStore } from '../../store/chatStore';
import { ArtifactContent } from './ArtifactContent';

export const ArtifactWindow: React.FC = () => {
  const {
    artifacts,
    selectedArtifactId,
    selectArtifact,
    toggleArtifactWindow,
  } = useChatStore();

  const selectedArtifact = artifacts.find(a => a.id === selectedArtifactId);

  return (
    <div className="w-1/2 border-l border-gray-200 bg-white flex flex-col">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-lg font-semibold">Artifacts</h2>
        <button
          onClick={() => toggleArtifactWindow()}
          className="text-gray-500 hover:text-gray-700"
        >
          <span className="sr-only">Close</span>
          ×
        </button>
      </div>
      
      <div className="flex-1 flex">
        <div className="w-64 border-r border-gray-200 overflow-y-auto">
          {artifacts.map((artifact) => (
            <button
              key={artifact.id}
              onClick={() => selectArtifact(artifact.id)}
              className={`w-full p-4 text-left hover:bg-gray-50 ${
                selectedArtifactId === artifact.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="font-medium">{artifact.title}</div>
              <div className="text-sm text-gray-500">
                {artifact.timestamp.toLocaleTimeString()}
              </div>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {selectedArtifact && (
            <ArtifactContent artifact={selectedArtifact} />
          )}
        </div>
      </div>
    </div>
  );
};
