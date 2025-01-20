import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import remarkGfm from 'remark-gfm';
import { Message } from '../../types/chat';
import { useChatStore } from '../../store/chatStore';

// Remove or set to a past date to enable copy buttons for all messages
// const COPY_FEATURE_START_DATE = new Date('2000-01-01');

export const ChatMessages: React.FC<{ messages: Message[] }> = ({ messages }) => {
  const { selectArtifact } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<string | null>(null);
  
  // Log messages when they change
  useEffect(() => {
    console.log('ChatMessages received:', messages);
  }, [messages]);

  // Function to check if user is near bottom
  const isNearBottom = () => {
    if (!containerRef.current) return true;
    const container = containerRef.current;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 100;
  };

  // Scroll to bottom if conditions are met
  const scrollToBottom = (force: boolean = false) => {
    if (!containerRef.current || !messagesEndRef.current) return;
    
    const shouldScroll = force || isNearBottom();
    if (shouldScroll) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Scroll on new messages
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    // Force scroll on user messages or if it's a new message
    const isNewMessage = lastMessage.id !== lastMessageRef.current;
    const forceScroll = lastMessage.role === 'user' || isNewMessage;
    
    scrollToBottom(forceScroll);
    lastMessageRef.current = lastMessage.id;
  }, [messages]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here if you want
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Helper function to determine if copy button should be shown
  const shouldShowCopyButton = () => {
    return true; // Show copy button for all messages
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'} animate-fade-in`}
        >
          <div 
            className={`max-w-3/4 rounded-lg p-4 relative group ${
              message.role === 'assistant' 
                ? 'bg-white border border-gray-200 prose prose-sm max-w-none dark:bg-gray-800 dark:border-gray-700 dark:prose-invert' 
                : 'bg-blue-500 text-white'
            }`}
          >
            {/* Copy button - only shown for new messages */}
            {shouldShowCopyButton() && (
              <button
                onClick={() => copyToClipboard(message.content)}
                className={`absolute top-2 right-2 p-1.5 rounded-md 
                  opacity-0 group-hover:opacity-100 transition-opacity duration-200
                  ${message.role === 'assistant' 
                    ? 'hover:bg-gray-100 text-gray-500 hover:text-gray-700 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-gray-300' 
                    : 'hover:bg-blue-600 text-white'
                  }`}
                title="Copy message"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-4 w-4" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" 
                  />
                </svg>
              </button>
            )}

            {message.role === 'assistant' ? (
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({node, ...props}) => <h1 className="text-4xl font-bold mb-6 mt-8 text-gray-900 dark:text-gray-100" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-3xl font-semibold mb-4 mt-6 text-gray-800 dark:text-gray-200" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-2xl font-medium mb-3 mt-5 text-gray-700 dark:text-gray-300" {...props} />,
                  p: ({node, ...props}) => <p className="mb-4 leading-relaxed text-gray-700 dark:text-gray-300" {...props} />,
                  ul: ({node, ordered, ...props}: { node: any, ordered?: boolean, [key: string]: any }) => <ul className="list-disc pl-6 mb-4" {...props} />,
                  ol: ({node, ordered, ...props}: { node: any, ordered?: boolean, [key: string]: any }) => <ol className="list-decimal pl-6 mb-4" {...props} />,
                  li: ({node, ordered, ...props}: { node: any, ordered?: boolean, [key: string]: any }) => <li className="mb-2 text-gray-700 dark:text-gray-300" {...props} />,
                  blockquote: ({node, ordered, ...props}: { node: any, ordered?: boolean, [key: string]: any }) => (
                    <blockquote className="border-l-4 border-blue-500 pl-4 italic my-4 text-gray-600 dark:text-gray-400" {...props} />
                  ),
                  pre: ({node, ...props}) => (
                    <pre className="bg-white" {...props} />
                  ),
                  code: ({node, inline, className, children, ...props}) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    const isFenced = className?.includes('language-');
                    
                    // For inline code (single backticks)
                    if (inline) {
                      return (
                        <code className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 text-sm" {...props}>
                          {children}
                        </code>
                      );
                    }
                    
                    // For fenced code blocks (triple backticks)
                    if (isFenced) {
                      return (
                        <div className="mb-4 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                          <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 text-sm font-mono text-gray-800 dark:text-gray-200 flex justify-between items-center">
                            <span className="uppercase font-semibold">{language || 'Text'}</span>
                            <button 
                              onClick={() => copyToClipboard(String(children))} 
                              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              title="Copy code"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                              </svg>
                            </button>
                          </div>
                          <div className="bg-white">
                            <SyntaxHighlighter
                              style={oneLight as any}
                              language={language}
                              PreTag="div"
                              customStyle={{
                                margin: 0,
                                borderRadius: 0,
                                background: 'white',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                              }}
                              wrapLines={true}
                              wrapLongLines={true}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      );
                    }
                    
                    // For non-code text, remove leading spaces from each line while preserving markdown
                    const cleanedText = String(children)
                      .split('\n')
                      .map(line => line.trimStart())
                      .join('\n');
                    return cleanedText;
                  },
                  img: ({node, ...props}) => (
                    <img className="max-w-full h-auto rounded-lg shadow-md my-4" {...props} />
                  ),
                  hr: ({node, ...props}) => (
                    <hr className="my-8 border-t border-gray-300 dark:border-gray-700" {...props} />
                  ),
                  a: ({node, href, children, ...props}) => {
                    if (href?.startsWith('artifact:')) {
                      return (
                        <button
                          onClick={() => selectArtifact(href.replace('artifact:', ''))}
                          className="text-blue-500 hover:underline"
                          type="button"
                        >
                          {children}
                        </button>
                      );
                    }
                    // Prevent javascript: URLs
                    if (href?.startsWith('javascript:')) {
                      return (
                        <button
                          onClick={(e) => e.preventDefault()}
                          className="text-blue-500 hover:underline"
                          type="button"
                        >
                          {children}
                        </button>
                      );
                    }
                    return (
                      <a 
                        href={href} 
                        className="text-blue-500 hover:underline" 
                        target="_blank"
                        rel="noopener noreferrer"
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {message.content.split('\n').map(line => line.trimStart()).join('\n')}
              </ReactMarkdown>
            ) : (
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
            )}
            {message.artifactId && (
              <button
                onClick={() => selectArtifact(message.artifactId ?? null)}
                className="mt-2 text-sm underline"
              >
                View Artifact
              </button>
            )}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};
