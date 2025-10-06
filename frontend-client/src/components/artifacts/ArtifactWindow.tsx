import React from 'react';
import { useChatStore } from '../../store/chatStore';
import { ArtifactContent } from './ArtifactContent';
// import KnowledgeGraphTestButton from './KnowledgeGraphTestButton';

interface ArtifactWindowProps {
  storageService: any;
}

export const ArtifactWindow: React.FC<ArtifactWindowProps> = ({ storageService }) => {
  const {
    artifacts,
    selectedArtifactId,
  } = useChatStore();

  // Remove excessive logging that happens on every render
  // Only log when selectedArtifactId changes
  React.useEffect(() => {
    console.log('ArtifactWindow: Selected artifact ID changed:', selectedArtifactId);
    console.log('ArtifactWindow: Available artifacts:', artifacts.map(a => ({ id: a.id, title: a.title, type: a.type })));
  }, [selectedArtifactId, artifacts]);

  const selectedArtifact = artifacts.find(a => a.id === selectedArtifactId);

  return (
    <div className="w-1/2 border-l border-gray-200 dark:border-gray-700 flex flex-col min-w-0">
      <div className="flex-1 flex min-h-0 min-w-0 bg-gray-200 dark:bg-gray-900">
        {selectedArtifact ? (
          <ArtifactContent artifact={selectedArtifact} storageService={storageService} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center p-4">
              <p>No artifact selected</p>
              {/* <KnowledgeGraphTestButton /> */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
