import React, { useState } from 'react';
import { Artifact } from '../../types/artifacts';
import DOMPurify from 'dompurify';

export const ArtifactContent: React.FC<{
  artifact: Artifact;
}> = ({ artifact }) => {
  const [viewMode, setViewMode] = useState<'rendered' | 'source'>('rendered');
  
  const sanitizeHTML = (content: string) => {
    return DOMPurify.sanitize(content, {
      USE_PROFILES: { html: true, svg: true },
      ADD_TAGS: ['style'],
      ADD_ATTR: ['viewBox', 'xmlns']
    });
  };

  const renderContent = () => {
    if (viewMode === 'source') {
      return (
        <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
          <code>{artifact.content}</code>
        </pre>
      );
    }

    switch (artifact.type) {
      case 'code':
        return (
          <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
            <code className={artifact.language ? `language-${artifact.language}` : ''}>
              {artifact.content}
            </code>
          </pre>
        );
      
      case 'html':
        return (
          <div 
            className="border rounded-lg p-4 bg-white"
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(artifact.content) }}
          />
        );
      
      case 'image/svg+xml':
        return (
          <div 
            className="border rounded-lg p-4 bg-white flex justify-center items-center"
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(artifact.content) }}
          />
        );
      
      case 'application/vnd.ant.mermaid':
        return <div className="mermaid">{artifact.content}</div>;
      
      default:
        return <div className="prose max-w-none">{artifact.content}</div>;
    }
  };

  const canToggleView = ['html', 'image/svg+xml'].includes(artifact.type);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">{artifact.title}</h3>
          <p className="text-sm text-gray-500">Type: {artifact.type}</p>
        </div>
        {canToggleView && (
          <button
            onClick={() => setViewMode(mode => mode === 'rendered' ? 'source' : 'rendered')}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            {viewMode === 'rendered' ? 'View Source' : 'View Rendered'}
          </button>
        )}
      </div>
      {renderContent()}
    </div>
  );
};
