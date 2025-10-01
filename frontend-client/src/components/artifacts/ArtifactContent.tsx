import React, { useState, useEffect } from 'react';
import { Artifact, ArtifactType } from '../../../../shared/artifacts';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { KnowledgeGraphViewer } from './KnowledgeGraphViewer';
import { ReagraphKnowledgeGraphViewer } from './ReagraphKnowledgeGraphViewer';
import { ProteinVisualizationViewer } from './ProteinVisualizationViewer';
import { CodeEditorView } from './CodeEditorView';
import { useChatStore } from '../../store/chatStore';
import { Pin, PinOff } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
// @ts-ignore - Heroicons type definitions mismatch
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline';

export const ArtifactContent: React.FC<{
  artifact: Artifact;
  storageService?: any;
}> = ({ artifact, storageService }) => {
  const [viewMode, setViewMode] = useState<'rendered' | 'editor'>('rendered');
  const [copySuccess, setCopySuccess] = useState(false);
  const [useReagraph,] = useState(false); // Temporarily disabled due to reagraph initialization error
  const [savingToProject, setSavingToProject] = useState(false);
  const [editedCode, setEditedCode] = useState<string>('');
  
  // State for handling file reference artifacts
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);
  
  // Use selector functions to only subscribe to the specific state we need
  const isPinnedArtifact = useChatStore(state => state.isPinnedArtifact);
  const toggleArtifactPin = useChatStore(state => state.toggleArtifactPin);
  const addArtifact = useChatStore(state => state.addArtifact);
  const addMessage = useChatStore(state => state.addMessage);
  const getPinnedArtifacts = useChatStore(state => state.getPinnedArtifacts);
  // Keep legacy support for knowledge graph components
  const setPinnedGraphId = useChatStore(state => state.setPinnedGraphId);
  const getPinnedGraphId = useChatStore(state => state.getPinnedGraphId);
  const { selectedProjectId } = useProjectStore();
  
  const isKnowledgeGraph = artifact.type === 'application/vnd.knowledge-graph' || artifact.type === 'application/vnd.ant.knowledge-graph';
  const isPinned = isPinnedArtifact(artifact.id);
  const isMarkdown = artifact.type === 'text/markdown';
  
  // Check if artifact supports editor view (code artifacts)
  const supportsEditorView = ['code', 'application/python', 'application/vnd.ant.python', 'application/javascript', 'application/vnd.react'].includes(artifact.type);

  // Check if this is a file reference artifact
  const isFileReference = !!(artifact.metadata?.fileReference);
  
  useEffect(() => {
    if (isFileReference && storageService && !isLoadingFile) {
      setIsLoadingFile(true);
      setFileLoadError(null);
      
      storageService.readContent(artifact.metadata.fileReference.fileId)
        .then((content: any) => {
          const fileRef = artifact.metadata!.fileReference!;
          let textContent: string;
          
          if (content instanceof Uint8Array) {
            const extension = fileRef.fileName.toLowerCase().split('.').pop() || '';
            if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) {
              // For images, convert to base64 using a more reliable method
              let binary = '';
              const len = content.byteLength;
              for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(content[i]);
              }
              const base64String = btoa(binary);
              textContent = base64String;
            } else {
              // For text files, decode as UTF-8
              textContent = new TextDecoder('utf-8').decode(content);
            }
          } else {
            textContent = content as string;
          }
          
          // Process content based on file type
          const extension = fileRef.fileName.toLowerCase().split('.').pop() || '';
          if (extension === 'csv') {
            import('../../utils/csvToMarkdown').then(({ csvToMarkdown }) => {
              setFileContent(csvToMarkdown(textContent));
              setIsLoadingFile(false);
            });
          } else if (extension === 'tsv') {
            import('../../utils/csvToMarkdown').then(({ tsvToMarkdown }) => {
              setFileContent(tsvToMarkdown(textContent));
              setIsLoadingFile(false);
            });
          } else {
            setFileContent(textContent);
            setIsLoadingFile(false);
          }
        })
        .catch((error: any) => {
          console.error('Failed to load file content:', error);
          setFileLoadError('Failed to load file content');
          setIsLoadingFile(false);
        });
    }
  }, [artifact.id]);
  
  // Clear content when artifact changes
  useEffect(() => {
    setFileContent('');
    setFileLoadError(null);
    setEditedCode(artifact.content); // Initialize edited code
  }, [artifact.id, artifact.content]);

  const handleSaveToProject = async () => {
    if (!storageService || !selectedProjectId || !isMarkdown) return;
    
    try {
      setSavingToProject(true);
      const fileName = `${artifact.title || 'document'}.md`;
      
      const contentToSave = isFileReference ? fileContent : artifact.content;
      await storageService.createFile(contentToSave, {
        description: fileName,
        tags: [`project:${selectedProjectId}`],
        schema: {
          type: 'file',
          format: 'text/markdown'
        }
      });
      
      setSavingToProject(false);
    } catch (error) {
      console.error('Failed to save to project:', error);
      setSavingToProject(false);
    }
  };

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
      const contentToCopy = isFileReference ? fileContent : artifact.content;
      await navigator.clipboard.writeText(contentToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleCodeExecution = async (code: string, language: string) => {
    console.log(`Executing ${language} code:`, code);
    
    try {
      // Map language to appropriate MCP server and tool
      let serverName = '';
      let toolName = '';
      switch (language.toLowerCase()) {
        case 'python':
        case 'py':
          serverName = 'python';
          toolName = 'execute_python';
          break;
        case 'r':
          serverName = 'r';
          toolName = 'execute_r';
          break;
        case 'racket':
        case 'scheme':
          serverName = 'racket';
          toolName = 'execute_racket';
          break;
        default:
          throw new Error(`Execution not supported for language: ${language}`);
      }

      // Get pinned artifacts to pass as context
      const pinnedArtifacts = getPinnedArtifacts().map(artifact => ({
        id: artifact.id,
        type: artifact.type,
        title: artifact.title,
        content: artifact.content,
        metadata: artifact.metadata
      }));

      // Make direct API call to MCP execution endpoint
      const response = await fetch('/api/mcp-execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverName,
          toolName,
          arguments: { code },
          attachments: [], // TODO: Get current attachments if available
          pinnedArtifacts
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Code execution result:', result);
      
      if (result.success && result.result) {
        // Create a message for the code execution
        const artifactIds: string[] = [];
        let messageContent = `Executed ${language} code\n\n`;
        
        // Helper function to create artifact button HTML
        const createArtifactButton = (id: string, type: string, title: string): string => {
          return `<button class="artifact-button text-sm text-blue-600 dark:text-blue-400 hover:underline" data-artifact-id="${id}" data-artifact-type="${type}" style="cursor: pointer; background: none; border: none; padding: 0;">📎 ${title}</button>`;
        };
        
        // 1. Create artifact for the execution output/text
        if (result.result.content && Array.isArray(result.result.content)) {
          const textContent = result.result.content
            .filter((item: any) => item.type === 'text')
            .map((item: any) => item.text)
            .join('\n');
            
          if (textContent.trim()) {
            const artifactId = addArtifact({
              id: crypto.randomUUID(),
              artifactId: crypto.randomUUID(),
              type: 'text/markdown' as ArtifactType,
              title: `${language} Execution Output`,
              content: textContent,
              position: artifactIds.length
            });
            artifactIds.push(artifactId);
            messageContent += `**Output:**\n${createArtifactButton(artifactId, 'text/markdown', `${language} Execution Output`)}\n\n`;
          }
        }
        
        // 2. Handle binary outputs (plots, images, etc.)
        if (result.result.binaryOutput) {
          const binaryOutput = result.result.binaryOutput;
          const title = binaryOutput.title || `Generated ${binaryOutput.type.split('/')[1]}`;
          const artifactId = addArtifact({
            id: crypto.randomUUID(),
            artifactId: crypto.randomUUID(),
            type: binaryOutput.type as ArtifactType,
            title: title,
            content: binaryOutput.data,
            position: artifactIds.length
          });
          artifactIds.push(artifactId);
          messageContent += `**Generated:**\n${createArtifactButton(artifactId, binaryOutput.type, title)}\n\n`;
        }
        
        // 3. Handle artifacts array from MCP response
        if (result.result.artifacts && Array.isArray(result.result.artifacts)) {
          console.log('MCP artifacts found:', result.result.artifacts.length);
          result.result.artifacts.forEach((mcpArtifact: any, index: number) => {
            console.log(`MCP artifact ${index}:`, {
              type: mcpArtifact.type,
              title: mcpArtifact.title,
              hasContent: !!mcpArtifact.content,
              contentLength: mcpArtifact.content?.length,
              hasMetadata: !!mcpArtifact.metadata,
              hasFileReference: !!mcpArtifact.metadata?.fileReference,
              fileId: mcpArtifact.metadata?.fileReference?.fileId
            });
            
            const artifactId = addArtifact({
              id: crypto.randomUUID(),
              artifactId: crypto.randomUUID(),
              type: mcpArtifact.type as ArtifactType,
              title: mcpArtifact.title,
              content: mcpArtifact.content,
              position: artifactIds.length,
              language: mcpArtifact.language,
              metadata: mcpArtifact.metadata // This includes fileReference for server-side storage artifacts
            });
            artifactIds.push(artifactId);
            messageContent += `**Created:**\n${createArtifactButton(artifactId, mcpArtifact.type, mcpArtifact.title)}\n\n`;
          });
        }
        
        // Add the execution message to the chat transcript
        addMessage({
          role: 'assistant',
          content: messageContent.trim(),
          artifactId: artifactIds[0], // Primary artifact for backward compatibility
          artifactIds: artifactIds
        } as any);
        
        if (artifactIds.length > 0) {
          alert(`Code executed successfully! Created ${artifactIds.length} artifact(s) and added to chat.`);
        } else {
          alert('Code executed successfully! Check console for results.');
        }
      } else {
        alert(`Code execution failed: ${result.error}`);
      }

    } catch (error) {
      console.error('Code execution failed:', error);
      alert(`Code execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const renderContent = () => {
    // Handle file reference artifacts
    if (isFileReference) {
      if (isLoadingFile) {
        return (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <span className="ml-2">Loading file content...</span>
          </div>
        );
      }
      
      if (fileLoadError) {
        return (
          <div className="text-red-500 p-4">
            <p>Error loading file: {fileLoadError}</p>
            <p className="text-sm text-gray-500 mt-2">
              File: {artifact.metadata?.fileReference?.fileName}
            </p>
          </div>
        );
      }
      
      if (!fileContent) {
        return (
          <div className="text-gray-500 p-4">
            <p>No content available</p>
          </div>
        );
      }
    }
    
    // Get the content to display
    const displayContent = isFileReference ? fileContent : artifact.content;
    

    switch (artifact.type) {
      case 'code':
      case 'application/python':
      case 'application/vnd.ant.python':
      case 'application/javascript':
      case 'application/vnd.react':
        // Handle different view modes for code artifacts
        if (viewMode === 'editor') {
          return (
            <CodeEditorView
              code={editedCode}
              language={artifact.language || getLanguage(artifact.type, artifact.language)}
              title={artifact.language || artifact.type.replace('application/', '')}
              isDarkMode={false} // TODO: Get from theme context
              readOnly={false}
              onChange={setEditedCode}
              onExecute={handleCodeExecution}
            />
          );
        }
        
        
        // Default rendered view with syntax highlighting
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
                {displayContent}
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
                  data={displayContent} 
                  artifactId={artifact.id}
                />
              </div>
            ) : (
              <KnowledgeGraphViewer 
                data={displayContent} 
                artifactId={artifact.id}
                showVersionControls={true}
              />
            )}
          </div>
        );
      
      case 'application/vnd.protein-visualization':
        return (
          <div className="w-full h-full min-h-[500px] flex flex-col">
            <ProteinVisualizationViewer 
              data={displayContent}
            />
          </div>
        );
      
      case 'html':
        return (
          <div 
            className="border rounded-lg p-4 bg-white"
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(displayContent) }}
          />
        );
      
      case 'image/png':
        return (
          <div className="flex flex-col items-center gap-4">
            <div className="flex justify-center items-center">
              <img 
                src={`data:image/png;base64,${displayContent}`}
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
              __html: sanitizeHTML(displayContent.trim()) 
            }}
          />
        );
      
      case 'application/vnd.ant.mermaid':
        return <div className="mermaid">{displayContent}</div>;
      
      case 'text/markdown':
        const trimmedContent = (() => {
          // Check if we have a JSON string with nested content
          if (displayContent.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(displayContent);
              // If it has a content property, use that instead
              if (parsed.content) {
                console.log('Found nested content in artifact, extracting inner content');
                return typeof parsed.content === 'string' 
                  ? parsed.content.split('\n').map((line: string) => line.trimStart()).join('\n')
                  : displayContent.split('\n').map((line: string) => line.trimStart()).join('\n');
              }
            } catch (e) {
              console.log('Content looks like JSON but failed to parse:', e);
            }
          }
          // Default trimming for normal content
          return displayContent.split('\n').map((line: string) => line.trimStart()).join('\n');
        })();

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

                  const excludedProps = ['ordered', 'checked', 'node', 'className'];
                  const cleanProps = Object.fromEntries(
                    Object.entries(props).filter(([key]) => !excludedProps.includes(key))
                  );
                                    
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
        return <div className="prose max-w-none whitespace-pre-wrap">{displayContent}</div>;

      case 'application/vnd.bibliography':
        try {
          // Check if content is already an object or a string that needs parsing
          const bibliography = typeof displayContent === 'string' 
            ? JSON.parse(displayContent) 
            : displayContent;
          
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
          return <div className="prose max-w-none whitespace-pre-wrap">{typeof displayContent === 'string' ? displayContent : 'Invalid bibliography format'}</div>;
        }

      case 'application/json':
      case 'application/vnd.ant.json':
        try {
          // Try to parse and pretty-print the JSON
          const jsonObj = typeof displayContent === 'string' 
            ? JSON.parse(displayContent) 
            : displayContent;
          
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
          return renderFallbackContent(displayContent);
        }

      default:
        return renderFallbackContent(displayContent);
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

  const canToggleView = ['html', 'image/svg+xml', 'application/vnd.knowledge-graph', 'application/vnd.ant.knowledge-graph'].includes(artifact.type) || supportsEditorView;

  return (
    <div className="h-full mx-auto w-[95%] flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-lg">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{artifact.title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Type: {artifact.type === 'code' && artifact.language ? `${artifact.type} (${artifact.language})` : artifact.type}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {/* Pin button for all artifact types */}
          <button
            onClick={() => toggleArtifactPin(artifact.id)}
            className={`p-2 rounded-full ${
              isPinned 
                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            }`}
            title={isPinned ? "Unpin artifact (stop sending with messages)" : "Pin artifact (send with messages)"}
          >
            {isPinned ? <PinOff size={18} /> : <Pin size={18} />}
          </button>
          
          {isMarkdown && selectedProjectId && (
            <button
              onClick={handleSaveToProject}
              disabled={savingToProject}
              className={`px-3 py-1 text-sm bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 
                       border border-gray-300 dark:border-gray-600 rounded-md shadow-sm flex items-center gap-1
                       ${savingToProject ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <DocumentArrowDownIcon className="w-4 h-4" />
              {savingToProject ? 'Saving...' : 'Save to Project'}
            </button>
          )}
          
          {isFileReference && artifact.metadata?.fileReference && (
            <button
              onClick={() => {
                const fileId = artifact.metadata!.fileReference!.fileId;
                const fileName = artifact.metadata!.fileReference!.fileName;
                
                // Create download link and trigger download
                const downloadUrl = `/api/storage/files/${fileId}/download`;
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="px-3 py-1 text-sm bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 
                       border border-gray-300 dark:border-gray-600 rounded-md shadow-sm flex items-center gap-1"
            >
              <DocumentArrowDownIcon className="w-4 h-4" />
              Download
            </button>
          )}
          
          {canToggleView && !supportsEditorView && (
            <div className="flex items-center space-x-1">
                <button
                  onClick={() => setViewMode(mode => mode === 'rendered' ? 'editor' : 'rendered')}
                  className="px-3 py-1 text-sm bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm"
                >
                  {viewMode === 'rendered' ? 'View Source' : 'View Rendered'}
                </button>
            </div>
          )}
          {supportsEditorView && (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setViewMode('rendered')}
                className={`px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm ${
                  viewMode === 'rendered' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                View
              </button>
              <button
                onClick={() => setViewMode('editor')}
                className={`px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm ${
                  viewMode === 'editor' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Edit
              </button>
            </div>
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
