import React from 'react';
import { useChatStore } from '../../store/chatStore';
import { ArtifactContent } from './ArtifactContent';

export const ArtifactWindow: React.FC = () => {
  const {
    artifacts,
    selectedArtifactId,
  } = useChatStore();

  console.log('ArtifactWindow: Rendering with selectedArtifactId:', selectedArtifactId);
  console.log('ArtifactWindow: Available artifacts:', artifacts);

  const selectedArtifact = artifacts.find(a => a.id === selectedArtifactId);
  console.log('ArtifactWindow: Selected artifact:', selectedArtifact);

  return (
    <div className="w-1/2 border-l border-gray-200 dark:border-gray-700 flex flex-col min-w-0">
      <div className="flex-1 flex min-h-0 min-w-0 bg-gray-200 dark:bg-gray-900">
        <div className="flex-1 h-full p-4 min-w-0">
          {selectedArtifact && (
            <div className="h-full min-w-0">
              <ArtifactContent artifact={selectedArtifact} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
