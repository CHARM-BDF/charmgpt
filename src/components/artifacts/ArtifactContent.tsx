import React, { useState } from 'react';
import { Artifact } from '../../types/artifacts';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { KnowledgeGraphViewer } from './KnowledgeGraphViewer';
import { ReagraphKnowledgeGraphViewer } from './ReagraphKnowledgeGraphViewer';
import { useChatStore } from '../../store/chatStore';
import { useMCPStore } from '../../store/mcpStore';
import { Pin, PinOff } from 'lucide-react';

export const ArtifactContent: React.FC<{
  artifact: Artifact;
}> = ({ artifact }) => {
  const [viewMode, setViewMode] = useState<'rendered' | 'source'>('rendered');
  const [copySuccess, setCopySuccess] = useState(false);
  const [useReagraph, setUseReagraph] = useState(true);
  
  // Use selector functions to only subscribe to the specific state we need
  const setPinnedGraphId = useChatStore(state => state.setPinnedGraphId);
  const pinnedGraphId = useChatStore(state => state.pinnedGraphId);
  
  const isKnowledgeGraph = artifact.type === 'application/vnd.knowledge-graph' || artifact.type === 'application/vnd.ant.knowledge-graph';
  const isPinned = isKnowledgeGraph ? pinnedGraphId === artifact.id : false;
  
  const sanitizeHTML = (content: string) => {
    return DOMPurify.sanitize(content, {
      USE_PROFILES: { html: true, svg: true },
      ADD_TAGS: ['style'],
      ADD_ATTR: ['viewBox', 'xmlns']
    });
  };

  const getLanguage = (type: string, language?: string): string => {
    if (language) {
      return language;
    }
    
    switch (type) {
      case 'application/python':
      case 'application/vnd.ant.python':
        return 'python';
      case 'application/javascript':
        return 'javascript';
      case 'application/vnd.react':
        return 'jsx';
      case 'application/json':
      case 'application/vnd.ant.json':
        return 'json';
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
      // For knowledge graph artifacts, format as JSON with syntax highlighting
      if (artifact.type === 'application/vnd.knowledge-graph' || artifact.type === 'application/vnd.ant.knowledge-graph') {
        try {
          // Parse and pretty-print the JSON
          const jsonObj = typeof artifact.content === 'string' 
            ? JSON.parse(artifact.content) 
            : artifact.content;
          
          const prettyJson = JSON.stringify(jsonObj, null, 2);
          
          return (
            <div className="bg-gray-50 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-md">
              <div className="bg-gray-100 px-4 py-2 text-sm font-mono text-gray-800 border-b border-gray-200 dark:border-gray-700">
                Knowledge Graph JSON
              </div>
              <div className="p-4">
                <SyntaxHighlighter
                  language="json"
                  style={oneLight}
                  customStyle={{ margin: 0, background: 'transparent' }}
                >
                  {prettyJson}
                </SyntaxHighlighter>
              </div>
            </div>
          );
        } catch (error) {
          console.error('Failed to parse knowledge graph JSON:', error);
        }
      }
      
      // Default source view for other types
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
      case 'application/vnd.ant.python':
      case 'application/javascript':
      case 'application/vnd.react':
        return (
          <div className="bg-gray-50 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-md">
            <div className="bg-gray-100 px-4 py-2 text-sm font-mono text-gray-800 border-b border-gray-200 dark:border-gray-700">
              {artifact.language || artifact.type.replace('application/', '')}
            </div>
            <div className="p-4">
              <SyntaxHighlighter
                language={getLanguage(artifact.type, artifact.language)}
                style={oneLight}
                customStyle={{ margin: 0, background: 'transparent' }}
              >
                {artifact.content}
              </SyntaxHighlighter>
            </div>
          </div>
        );
      
      case 'application/vnd.knowledge-graph':
      case 'application/vnd.ant.knowledge-graph':
        // Only log in development mode
        // if (process.env.NODE_ENV === 'development') {
        //   console.log('Rendering knowledge graph artifact:', {
        //     id: artifact.id,
        //     title: artifact.title,
        //     versionNumber: artifact.versionNumber,
        //     previousVersionId: artifact.previousVersionId,
        //     nextVersionId: artifact.nextVersionId
        //   });
        // }
        
        return (
          <div className="w-full h-full min-h-[400px] flex flex-col">
            {useReagraph ? (
              <div className="w-full h-full overflow-hidden">
                <ReagraphKnowledgeGraphViewer 
                  data={artifact.content} 
                  artifactId={artifact.id}
                />
              </div>
            ) : (
              <KnowledgeGraphViewer 
                data={artifact.content} 
                artifactId={artifact.id}
                showVersionControls={true}
              />
            )}
          </div>
        );
      
      case 'html':
        return (
          <div 
            className="border rounded-lg p-4 bg-white"
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(artifact.content) }}
          />
        );
      
      case 'image/png':
        return (
          <div className="flex flex-col items-center gap-4">
            <div className="flex justify-center items-center">
              <img 
                src={`data:image/png;base64,${artifact.content}`}
                alt={artifact.title}
                className="max-w-full h-auto"
              />
            </div>
            {artifact.sourceCode && (
              <div className="w-full">
                <div className="bg-gray-50 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-md">
                  <div className="bg-gray-100 px-4 py-2 text-sm font-mono text-gray-800 dark:text-gray-200">
                    Source Code
                  </div>
                  <div className="p-4">
                    <SyntaxHighlighter
                      language="python"
                      style={oneLight}
                      customStyle={{ margin: 0, background: 'transparent' }}
                    >
                      {artifact.sourceCode}
                    </SyntaxHighlighter>
                  </div>
                </div>
              </div>
            )}
          </div>
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

        // Debug logging
        console.log('Content being passed to ReactMarkdown:', {
          contentLength: trimmedContent.length,
          tableIndex: trimmedContent.indexOf('<table'),
          sample: trimmedContent.substring(trimmedContent.indexOf('<table'), trimmedContent.indexOf('<table') + 100)
        });

        return (
          <div className="prose max-w-none dark:prose-invert">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw as any]}
              skipHtml={false}
              rawSourcePos={true}
              components={{
                h1: ({node, children, ...props}: any) => (
                  <h1 className="font-display text-2xl font-extrabold mb-4 mt-6 text-gray-900 dark:text-gray-100 tracking-tight" {...props}>{children}</h1>
                ),
                h2: ({node, children, ...props}: any) => (
                  <h2 className="font-display text-xl font-bold mb-3 mt-5 text-gray-800 dark:text-gray-200 tracking-tight" {...props}>{children}</h2>
                ),
                h3: ({node, ...props}: any) => (
                  <h3 className="font-display text-lg font-bold mb-2 mt-4 text-gray-700 dark:text-gray-300 tracking-tight" {...props}>{props.children}</h3>
                ),
                p: ({node, ...props}: any) => (
                  <p className="font-sans text-[15px] mb-3 leading-relaxed text-gray-700 dark:text-gray-300" {...props} />
                ),
                ul: ({node, ...props}: any) => {
                  return <ul className="font-sans list-disc pl-5 mb-3 space-y-1.5" {...props} />;
                },
                ol: ({ node, ...props }: any) => {
                  return <ol className="font-sans list-decimal pl-5 mb-3 space-y-1.5" {...props} />;
                },
                
                li: ({node, checked, ordered, children, ...props}: any) => {
                  // Debug logging for li component props
                  // console.log('Li Component Props:', {
                  //   ordered,
                  //   checked,
                  //   otherProps: props,
                  //   nodeType: node?.type,
                  //   parentType: node?.parent?.type,
                  //   children: children
                  // });
                  
                  // Remove all non-HTML attributes
                  const { ordered: _, checked: __, node: ___, className: ____, ...cleanProps } = props;
                  
                  return (
                    <li className="font-sans text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed" {...cleanProps}>
                      {children}
                    </li>
                  );
                },
                blockquote: ({node, ...props}: any) => (
                  <blockquote className="font-sans border-l-3 border-blue-500 pl-4 my-3 text-gray-600 dark:text-gray-400" {...props} />
                ),
                code: ({node, inline, className, children, ...props}: any) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const language = match ? match[1] : '';
                  
                  if (inline) {
                    return (
                      <code className="font-mono bg-gray-100 dark:bg-[#1F2937] rounded px-1.5 py-0.5 text-sm" {...props}>
                        {children}
                      </code>
                    );
                  }

                  return (
                    <div className="mb-4 overflow-hidden rounded-md border-2 border-gray-200 dark:border-gray-700 shadow-md">
                      <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-mono text-gray-800 dark:text-gray-200 flex justify-between items-center">
                        <span className="uppercase font-semibold">{language || 'Output'}</span>
                      </div>
                      <div className="bg-gray-50 dark:bg-[#1F2937]">
                        <SyntaxHighlighter
                          language={language || 'text'}
                          style={oneLight}
                          customStyle={{
                            margin: 0,
                            borderRadius: 0,
                            background: 'inherit',
                            padding: '1rem'
                          }}
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  );
                },
                table: ({node, children, ...props}: any) => {
                  // Debug logging
                  console.log('Table component props:', {
                    nodeType: node?.type,
                    childrenType: typeof children,
                    childrenContent: children,
                    hasTableTag: String(children || '').includes('<table'),
                    props
                  });

                  // Check if this is an HTML table by looking at the className
                  if (props.className && props.className.includes('table')) {
                    console.log('Rendering HTML table with props:', props);
                    return (
                      <table className={`${props.className} border`}>
                        {children}
                      </table>
                    );
                  }
                  
                  // Regular markdown table
                  console.log('Rendering markdown table');
                  return <table className="min-w-full border" {...props}>{children}</table>;
                },
                thead: ({node, ...props}: any) => (
                  <thead {...props} />
                ),
                tr: ({node, ...props}: any) => (
                  <tr {...props} />
                ),
                th: ({node, ...props}: any) => (
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 border" {...props} />
                ),
                td: ({node, ...props}: any) => (
                  <td className="px-4 py-2 text-sm text-gray-900 border" {...props} />
                ),
                div: ({node, ...props}: any) => <div {...props} />,
                html: ({children, ...props}: any) => {
                  console.log('HTML component received:', {
                    childrenType: typeof children,
                    childrenContent: children?.substring?.(0, 100),
                    props
                  });
                  
                  if (children && children.includes('<table')) {
                    // Add border classes to the table HTML
                    const styledHtml = children.replace(
                      '<table class="',
                      '<table class=" text-gray-900 border" '
                    ).replace(
                      '<td',
                      '<td class="text-gray-900 border"'
                    ).replace(
                      '<th',
                      '<th class="text-gray-900 border"'
                    );
                    
                    return (
                      <div 
                        className="my-4 overflow-x-auto"
                        dangerouslySetInnerHTML={{ 
                          __html: sanitizeHTML(styledHtml)
                        }} 
                      />
                    );
                  }
                  return null;
                }
              }}
            >
              {trimmedContent}
            </ReactMarkdown>
          </div>
        );

      case 'text':
        return <div className="prose max-w-none whitespace-pre-wrap">{artifact.content}</div>;

      case 'application/vnd.bibliography':
        try {
          // Check if content is already an object or a string that needs parsing
          const bibliography = typeof artifact.content === 'string' 
            ? JSON.parse(artifact.content) 
            : artifact.content;
          
          return (
            <div className="prose max-w-none dark:prose-invert">
              <h2>Bibliography</h2>
              {bibliography.map((entry: any, index: number) => {
                const displayAuthors = entry.authors && entry.authors.length > 5 
                  ? entry.authors.slice(0, 5)
                  : entry.authors || [];
                
                const hasMoreAuthors = entry.authors && entry.authors.length > 5;
                const allAuthors = entry.authors ? entry.authors.join(', ') : '';

                return (
                  <div key={entry.pmid || index} className="mb-4">
                    <p className="[text-indent:-1em] [padding-left:1em]">
                      {index + 1}. {displayAuthors.join(', ')}
                      {hasMoreAuthors && (
                        <span 
                          title={allAuthors}
                          className="cursor-help"
                        >, et al.</span>
                      )} ({entry.year || 'n.d.'}). {entry.title || 'Untitled'}. <em>{entry.journal || ''}</em>.{' '}
                      {entry.pmid && (
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
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          );
        } catch (error) {
          console.error('Failed to parse bibliography:', error);
          return <div className="prose max-w-none whitespace-pre-wrap">{typeof artifact.content === 'string' ? artifact.content : 'Invalid bibliography format'}</div>;
        }

      case 'application/json':
      case 'application/vnd.ant.json':
        try {
          // Try to parse and pretty-print the JSON
          const jsonObj = typeof artifact.content === 'string' 
            ? JSON.parse(artifact.content) 
            : artifact.content;
          
          const prettyJson = JSON.stringify(jsonObj, null, 2);
          
          return (
            <div className="bg-gray-50 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-md">
              <div className="bg-gray-100 px-4 py-2 text-sm font-mono text-gray-800 border-b border-gray-200 dark:border-gray-700">
                JSON
              </div>
              <div className="p-4">
                <SyntaxHighlighter
                  language="json"
                  style={oneLight}
                  customStyle={{ margin: 0, background: 'transparent' }}
                >
                  {prettyJson}
                </SyntaxHighlighter>
              </div>
            </div>
          );
        } catch (error) {
          console.error('Failed to parse JSON:', error);
          // If JSON parsing fails, try to render as markdown or plain text
          return renderFallbackContent(artifact.content);
        }

      default:
        return renderFallbackContent(artifact.content);
    }
  };

  // Helper function to render content when the type is unknown or parsing fails
  const renderFallbackContent = (content: string) => {
    // First try to parse as JSON
    try {
      const jsonObj = JSON.parse(content);
      const prettyJson = JSON.stringify(jsonObj, null, 2);
      
      return (
        <div className="bg-gray-50 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-md">
          <div className="bg-gray-100 px-4 py-2 text-sm font-mono text-gray-800 border-b border-gray-200 dark:border-gray-700">
            JSON (Auto-detected)
          </div>
          <div className="p-4">
            <SyntaxHighlighter
              language="json"
              style={oneLight}
              customStyle={{ margin: 0, background: 'transparent' }}
            >
              {prettyJson}
            </SyntaxHighlighter>
          </div>
        </div>
      );
    } catch {
      // Not valid JSON, try markdown
      try {
        return (
          <div className="prose max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        );
      } catch {
        // Not valid markdown either, just show as plain text
        return <div className="prose max-w-none whitespace-pre-wrap">{content}</div>;
      }
    }
  };

  const canToggleView = ['html', 'image/svg+xml', 'application/vnd.knowledge-graph', 'application/vnd.ant.knowledge-graph'].includes(artifact.type);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-lg">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{artifact.title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Type: {artifact.type === 'code' && artifact.language ? `${artifact.type} (${artifact.language})` : artifact.type}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {canToggleView && (
            <button
              onClick={() => setViewMode(mode => mode === 'rendered' ? 'source' : 'rendered')}
              className="px-3 py-1 text-sm bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
            >
              {viewMode === 'rendered' ? 'View Source' : 'View Rendered'}
            </button>
          )}
        </div>
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
