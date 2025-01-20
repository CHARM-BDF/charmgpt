import React, { useState } from 'react';
import { Artifact } from '../../types/artifacts';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';

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

  const getLanguage = (type: string): string => {
    switch (type) {
      case 'application/python':
        return 'python';
      case 'application/javascript':
        return 'javascript';
      case 'application/vnd.react':
        return 'jsx';
      case 'code':
        return 'text';
      default:
        return 'text';
    }
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
      case 'application/python':
      case 'application/javascript':
      case 'application/vnd.react':
        return (
          <div className="bg-gray-50 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 text-sm font-mono text-gray-800">
              {artifact.type.replace('application/', '')}
            </div>
            <div className="p-4">
              <SyntaxHighlighter
                language={getLanguage(artifact.type)}
                style={oneLight}
                customStyle={{ margin: 0, background: 'transparent' }}
              >
                {artifact.content}
              </SyntaxHighlighter>
            </div>
          </div>
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
            dangerouslySetInnerHTML={{ 
              __html: sanitizeHTML(artifact.content.trim()) 
            }}
          />
        );
      
      case 'application/vnd.ant.mermaid':
        return <div className="mermaid">{artifact.content}</div>;
      
      case 'text/markdown':
        return (
          <div className="prose max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {artifact.content}
            </ReactMarkdown>
          </div>
        );

      case 'text':
        return <div className="prose max-w-none whitespace-pre-wrap">{artifact.content}</div>;

      default:
        // Try to render as markdown first, fallback to pre-wrapped text
        try {
          return (
            <div className="prose max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {artifact.content}
              </ReactMarkdown>
            </div>
          );
        } catch {
          return <div className="prose max-w-none whitespace-pre-wrap">{artifact.content}</div>;
        }
    }
  };

  const canToggleView = ['html', 'image/svg+xml'].includes(artifact.type);

  return (
    <div className="h-full overflow-y-auto p-4">
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
      <div className="overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
};
