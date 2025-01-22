import React from 'react';
import { useChatStore } from '../../store/chatStore';
import { ArtifactContent } from './ArtifactContent';

export const ArtifactWindow: React.FC = () => {
  const {
    artifacts,
    selectedArtifactId,
  } = useChatStore();

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
      </div>
    </div>
  );
};
