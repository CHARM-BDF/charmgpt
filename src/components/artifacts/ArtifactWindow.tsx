import React from 'react';
import { useChatStore } from '../../store/chatStore';
import { ArtifactContent } from './ArtifactContent';

export const ArtifactWindow: React.FC = () => {
  const {
    artifacts,
    selectedArtifactId,
    selectArtifact,
    deleteArtifact,
    showList
  } = useChatStore();

  const formatTimestamp = (timestamp: Date | string) => {
    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      return date.toLocaleTimeString();
    } catch (e) {
      console.warn('Invalid timestamp format:', timestamp);
      return 'Unknown time';
    }
  };

  const selectedArtifact = artifacts.find(a => a.id === selectedArtifactId);

  return (
    <div className="w-1/2 border-l border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="flex-1 flex min-h-0 bg-gray-200 dark:bg-gray-900">
        <div className="flex-1 overflow-y-auto">
          {selectedArtifact && (
            <div className="p-4">
              <ArtifactContent artifact={selectedArtifact} />
            </div>
          )}
        </div>

        {showList && (
          <div className="w-64 border-l border-gray-200 dark:border-gray-700 overflow-y-auto bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
            <div className="h-full">
              {artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className={`relative group border-b border-gray-100 dark:border-gray-800 ${
                    selectedArtifactId === artifact.id ? 'bg-blue-50 dark:bg-blue-900' : ''
                  }`}
                >
                  <button
                    onClick={() => selectArtifact(artifact.id)}
                    className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">{artifact.title}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {formatTimestamp(artifact.timestamp)}
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteArtifact(artifact.id);
                    }}
                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                    title="Delete artifact"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
