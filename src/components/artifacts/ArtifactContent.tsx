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
  const [copySuccess, setCopySuccess] = useState(false);
  
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const renderContent = () => {
    if (viewMode === 'source') {
      return (
        <div className="relative w-full min-w-0 overflow-x-auto">
          <pre className="w-max bg-gray-50 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 shadow-md">
            <code className="whitespace-pre">{artifact.content}</code>
          </pre>
        </div>
      );
    }

    switch (artifact.type) {
      case 'code':
      case 'application/python':
      case 'application/javascript':
      case 'application/vnd.react':
        return (
          <div className="bg-gray-50 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-md">
            <div className="bg-gray-100 px-4 py-2 text-sm font-mono text-gray-800 border-b border-gray-200 dark:border-gray-700">
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
        const trimmedContent = artifact.content
          .split('\n')
          .map(line => line.trimStart())
          .join('\n');
        return (
          <div className="prose max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {trimmedContent}
            </ReactMarkdown>
          </div>
        );

      case 'text':
        return <div className="prose max-w-none whitespace-pre-wrap">{artifact.content}</div>;

      case 'application/vnd.bibliography':
        try {
          const bibliography = JSON.parse(artifact.content);
          return (
            <div className="prose max-w-none dark:prose-invert">
              <h2>Bibliography</h2>
              {bibliography.map((entry: any, index: number) => {
                const displayAuthors = entry.authors.length > 5 
                  ? entry.authors.slice(0, 5)
                  : entry.authors;
                
                const hasMoreAuthors = entry.authors.length > 5;
                const allAuthors = entry.authors.join(', ');

                return (
                  <div key={entry.pmid} className="mb-4">
                    <p className="[text-indent:-1em] [padding-left:1em]">
                      {index + 1}. {displayAuthors.join(', ')}
                      {hasMoreAuthors && (
                        <span 
                          title={allAuthors}
                          className="cursor-help"
                        >, et al.</span>
                      )} ({entry.year}). {entry.title}. <em>{entry.journal}</em>.{' '}
                      <a
                        href={`https://pubmed.ncbi.nlm.nih.gov/${entry.pmid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative inline-block ml-2 text-xs text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded no-underline"
                        style={{ 
                          padding: '2px 8px',
                          textIndent: 0,
                          lineHeight: 'normal',
                          verticalAlign: 'middle'
                        }}
                      >
                        Link to paper
                      </a>
                    </p>
                  </div>
                );
              })}
            </div>
          );
        } catch (error) {
          console.error('Failed to parse bibliography:', error);
          return <div className="prose max-w-none whitespace-pre-wrap">{artifact.content}</div>;
        }

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
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-lg">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{artifact.title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Type: {artifact.type}</p>
        </div>
        {canToggleView && (
          <button
            onClick={() => setViewMode(mode => mode === 'rendered' ? 'source' : 'rendered')}
            className="px-3 py-1 text-sm bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
          >
            {viewMode === 'rendered' ? 'View Source' : 'View Rendered'}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {renderContent()}
      </div>
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-lg flex justify-end">
        <button
          onClick={handleCopy}
          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
          title={copySuccess ? "Copied!" : "Copy content"}
        >
          {copySuccess ? (
            <svg className="w-5 h-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};
