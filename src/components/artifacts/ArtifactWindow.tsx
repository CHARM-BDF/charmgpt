import React from 'react';
import { useChatStore } from '../../store/chatStore';
import { ArtifactContent } from './ArtifactContent';
import KnowledgeGraphTestButton from './KnowledgeGraphTestButton';

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
          {selectedArtifact ? (
            <div className="h-full min-w-0">
              <ArtifactContent artifact={selectedArtifact} />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                  No artifact selected
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Select an artifact from the list or test the knowledge graph visualization.
                </p>
                <div className="flex justify-center">
                  <KnowledgeGraphTestButton />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
