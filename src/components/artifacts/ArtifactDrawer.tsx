import React from 'react';
import { useChatStore } from '../../store/chatStore';
import { ArtifactType } from '../../types/artifacts';

const TypeIcon: React.FC<{ type: ArtifactType }> = ({ type }) => {
  switch (type) {
    case 'code':
    case 'application/javascript':
    case 'application/python':
    case 'application/vnd.react':
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      );
    case 'text/markdown':
    case 'text':
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'image/svg+xml':
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'application/vnd.ant.mermaid':
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 3-3M4 6h16M4 18h16" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
  }
};

const ArtifactChip: React.FC<{
  title: string;
  type: ArtifactType;
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;
}> = ({ title, type, selected, onClick, onDelete }) => {
  return (
    <div 
      role="button"
      tabIndex={0}
      onClick={onClick}
      className={`
        group
        flex items-center gap-2
        px-3 py-2
        rounded-lg
        text-sm
        cursor-pointer
        transition-all duration-200
        ${selected 
          ? 'bg-blue-50 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100' 
          : 'bg-white/50 hover:bg-gray-50 text-gray-700 dark:bg-gray-800/50 dark:hover:bg-gray-700/50 dark:text-gray-300'
        }
      `}
    >
      <TypeIcon type={type} />
      <span className="truncate">{title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="ml-auto p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-opacity duration-200"
        title="Delete artifact"
      >
        ×
      </button>
    </div>
  );
};

export const ArtifactDrawer: React.FC = () => {
  const {
    artifacts,
    selectedArtifactId,
    selectArtifact,
    deleteArtifact,
    showList,
    setShowList,
    showArtifactWindow,
    toggleArtifactWindow
  } = useChatStore();

  const handleArtifactClick = (id: string) => {
    selectArtifact(id);
    setShowList(false); // Close the drawer
    if (!showArtifactWindow) {
      toggleArtifactWindow(); // Show the artifact window if it's not visible
    }
  };

  return (
    <div 
      className={`
        fixed top-[84px] right-0 h-[calc(100vh-84px)]
        bg-white/95 dark:bg-gray-800/95 backdrop-blur-md
        shadow-[-4px_0_15px_rgba(0,0,0,0.1)]
        dark:shadow-[-4px_0_15px_rgba(0,0,0,0.3)]
        transform transition-transform duration-300 ease-in-out
        ${showList ? 'translate-x-0' : 'translate-x-full'}
        border-l border-gray-200 dark:border-gray-700
        overflow-hidden
        flex flex-col
        z-50
        rounded-l-lg
      `}
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Artifacts</h2>
        <button
          onClick={() => setShowList(false)}
          className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors duration-200"
          title="Close drawer"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {artifacts.map((artifact) => (
            <ArtifactChip
              key={artifact.id}
              title={artifact.title}
              type={artifact.type}
              selected={artifact.id === selectedArtifactId}
              onClick={() => handleArtifactClick(artifact.id)}
              onDelete={() => deleteArtifact(artifact.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}; 