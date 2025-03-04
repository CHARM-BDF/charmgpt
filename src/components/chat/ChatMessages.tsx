import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MessageWithThinking } from '../../types/chat';
import { Artifact } from '../../types/artifacts';
import { useChatStore } from '../../store/chatStore';
import { AssistantMarkdown } from './AssistantMarkdown';
import { ClipboardIcon, DocumentTextIcon } from '@heroicons/react/24/solid';
import { BookOpen, FileText, GraduationCap, Library, Network, ChevronDown, ChevronRight } from 'lucide-react';
import BrainWaveCharm from '../animations/BrainWaveCharm';

// Remove or set to a past date to enable copy buttons for all messages
// const COPY_FEATURE_START_DATE = new Date('2000-01-01');

export const ChatMessages: React.FC<{ messages: MessageWithThinking[] }> = ({ messages }) => {
  // Use regular useChatStore without a selector function to avoid infinite loops
  const chatStore = useChatStore();
  
  // Extract only the properties we need using destructuring
  const { 
    selectArtifact, 
    isLoading, 
    streamingMessageId, 
    streamingContent, 
    artifacts,
    toggleStatusUpdatesCollapsed 
  } = chatStore;
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<string | null>(null);
  const [showThinkingMap, setShowThinkingMap] = useState<Record<string, boolean>>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  
  // Debug function to log all artifacts - only call this when needed, not on every render
  const logAllArtifacts = useCallback(() => {
    console.log("=== DEBUG: ALL ARTIFACTS ===");
    console.log(`Total artifacts in store: ${artifacts.length}`);
    
    // Log each artifact with full details
    artifacts.forEach((artifact, index) => {
      console.log(`Artifact ${index + 1}:`);
      console.log(`  ID: ${artifact.id}`);
      console.log(`  ArtifactID: ${artifact.artifactId}`);
    });
  }, [artifacts]);
  
  // Function to get all artifacts associated with a message
  const getMessageArtifacts = (message: MessageWithThinking) => {
    const result: Artifact[] = [];
    
    // Step 1: Get directly linked artifacts based on artifactId
    // console.log(`Step 1: Checking for linked artifacts for message ${message.id}`);
    if (message.artifactId) {
      const artifact = artifacts.find(a => a.id === message.artifactId);
      if (artifact) {
        // console.log(`  Found linked artifact: ${artifact.id} (${artifact.type})`);
        result.push(artifact);
      }
    }
    
    // Check for multiple artifacts using the new artifactIds property
    if ((message as any).artifactIds && Array.isArray((message as any).artifactIds)) {
      // console.log(`  Message has artifactIds property with ${(message as any).artifactIds.length} artifacts`);
      (message as any).artifactIds.forEach((id: string) => {
        if (id !== message.artifactId) { // Avoid duplicates
          const artifact = artifacts.find(a => a.id === id);
          if (artifact) {
            console.log(`  Found additional linked artifact: ${artifact.id} (${artifact.type})`);
            result.push(artifact);
          }
        }
      });
    }
    
    // Step 2: Get artifacts that reference this message
    // console.log(`Step 2: Checking for artifacts that reference message ${message.id}`);
    const referencingArtifacts = artifacts.filter(a => 
      a.content.includes(message.id) && !result.some(r => r.id === a.id)
    );
    if (referencingArtifacts.length > 0) {
      // console.log(`  Found ${referencingArtifacts.length} artifacts referencing this message`);
      result.push(...referencingArtifacts);
    }
    
    // Step 3: Extract artifact IDs from message content (buttons)
    // console.log(`Step 3: Checking for artifacts referenced in message content`);
    const buttonMatches = message.content.match(/data-artifact-id="([^"]+)"/g) || [];
    buttonMatches.forEach(match => {
      const artifactId = match.replace('data-artifact-id="', '').replace('"', '');
      const artifact = artifacts.find(a => a.id === artifactId);
      if (artifact && !result.some(r => r.id === artifact.id)) {
        // console.log(`  Found artifact referenced in content: ${artifact.id} (${artifact.type})`);
        result.push(artifact);
      }
    });
    
    // Log final result
    // console.log(`Found ${result.length} total artifacts for message ${message.id}`);
    return result;
  };

  // Log messages when they change
  useEffect(() => {
    console.log('ChatMessages received:', messages);
  }, [messages]);

  // Toggle thinking visibility for a specific message
  const toggleThinking = (messageId: string) => {
    setShowThinkingMap(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

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
      const behavior = streamingMessageId ? 'auto' : 'smooth';
      const options: ScrollIntoViewOptions = { 
        behavior: behavior as ScrollBehavior,
        block: 'start' as ScrollLogicalPosition 
      };
      messagesEndRef.current.scrollIntoView(options);
    }
  };

  // Scroll on new messages
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    // Force scroll on user messages or if it's a new message
    const isNewMessage = lastMessage.id !== lastMessageRef.current;
    const forceScroll = lastMessage.role === 'user' || isNewMessage;
    
    // Use requestAnimationFrame to ensure smooth scrolling during streaming
    requestAnimationFrame(() => scrollToBottom(forceScroll));
    lastMessageRef.current = lastMessage.id;
  }, [messages, streamingContent]); // Also watch streamingContent for scroll updates

  /**
   * CRITICAL: Copy Functionality
   * This function provides essential clipboard functionality for messages
   * DO NOT REMOVE: Required for user experience and accessibility
   */
  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000); // Hide after 2 seconds
      // console.log('Successfully copied to clipboard');
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Function to check if a message has status updates
  const hasStatusUpdates = (message: MessageWithThinking): boolean => {
    return !!message.statusUpdates && message.statusUpdates.includes('_Status:');
  };

  return (
    <div ref={containerRef} className="w-full max-w-3xl mx-auto px-4 pt-6">
      {/* Debug button - only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="flex justify-end mb-2">
          <button
            onClick={logAllArtifacts}
            className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Debug Artifacts
          </button>
        </div>
      )}
      
      <div className="w-full space-y-6">
        {messages.map((message) => {
          const messageWithThinking = message as MessageWithThinking;
          const isAssistant = message.role === 'assistant';
          const hasThinking = isAssistant && messageWithThinking.thinking;
          const isStreaming = streamingMessageId === message.id;
          
          return (
            <div
              key={message.id}
              className={`flex ${isAssistant ? 'justify-start' : 'justify-start'}`}
            >
              <div
                className={`w-full max-w-3xl rounded-lg p-6 shadow-sm relative ${
                  isAssistant
                    ? 'bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 shadow-gray-100 dark:shadow-gray-900/20'
                    : 'bg-white/95 dark:bg-gray-800/95 border border-gray-200/60 dark:border-gray-700/60 shadow-sm hover:shadow-md transition-shadow duration-200'
                }`}
              >
                {isAssistant && (
                  <>
                    <div className="absolute top-4 right-4">
                      <button
                        onClick={() => copyToClipboard(message.content, message.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                        title="Copy raw markdown"
                      >
                        {copiedMessageId === message.id ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-extrabold text-sm text-gray-900 dark:text-gray-100">Assistant</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date().toLocaleString(undefined, { 
                          month: 'numeric',
                          day: 'numeric',
                          year: '2-digit',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </span>
                    </div>
                  </>
                )}
                {isAssistant ? (
                  <>
                    {hasThinking && (
                      <div className="mb-2">
                        <button
                          onClick={() => toggleThinking(message.id)}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
                        >
                          <span>{showThinkingMap[message.id] ? '▼' : '▶'}</span>
                          <span>Thinking Process</span>
                        </button>
                        {showThinkingMap[message.id] && messageWithThinking.thinking && (
                          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                            <AssistantMarkdown content={messageWithThinking.thinking} />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex justify-between items-start">
                      <div className="flex-grow">
                        {isStreaming ? (
                          // For streaming messages
                          <>
                            <AssistantMarkdown content={streamingContent} />
                            <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse" />
                          </>
                        ) : (
                          // For completed messages
                          <>
                            {hasStatusUpdates(message) && (
                              <div className="mb-3">
                                <button
                                  onClick={() => toggleStatusUpdatesCollapsed(message.id)}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 mb-1"
                                >
                                  {message.statusUpdatesCollapsed ? (
                                    <ChevronRight className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )}
                                  <span>Processing Steps</span>
                                </button>
                                
                                {!message.statusUpdatesCollapsed && (
                                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300 font-mono">
                                    {message.statusUpdates?.split('\n').map((line, i) => (
                                      <div key={i} className="mb-1 last:mb-0">
                                        {line.replace(/_Status: /, '').replace(/_/g, '')}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <AssistantMarkdown 
                              content={message.content} 
                            />
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Display artifact links based on type */}
                    {(() => {
                      const messageArtifacts = getMessageArtifacts(message);
                      
                      // Bibliography artifact
                      const bibliographyArtifact = messageArtifacts.find(
                        artifact => artifact.type === 'application/vnd.bibliography'
                      );
                      
                      // Knowledge Graph artifact
                      const knowledgeGraphArtifact = messageArtifacts.find(
                        artifact => artifact.type === 'application/vnd.knowledge-graph' || artifact.type === 'application/vnd.ant.knowledge-graph'
                      );
                      
                      // JSON artifact
                      const jsonArtifact = messageArtifacts.find(
                        artifact => artifact.type === 'application/json' || artifact.type === 'application/vnd.ant.json'
                      );
                      
                      // Log found artifacts for debugging
                      // console.log(`Message ${message.id} artifacts:`, {
                      //   total: messageArtifacts.length,
                      //   artifactIds: messageArtifacts.map(a => a.id),
                      //   types: messageArtifacts.map(a => a.type),
                      //   hasBibliography: !!bibliographyArtifact,
                      //   hasKnowledgeGraph: !!knowledgeGraphArtifact,
                      //   hasJson: !!jsonArtifact,
                      //   messageArtifactId: message.artifactId
                      // });
                      
                      if (bibliographyArtifact || knowledgeGraphArtifact || jsonArtifact) {
                        return (
                          <div className="flex flex-col gap-3">
                            {bibliographyArtifact && (
                              <div className="my-4">
                                <BibliographyLinkLucide artifactId={bibliographyArtifact.id} />
                              </div>
                            )}
                            {knowledgeGraphArtifact && (
                              <div className="my-4">
                                <KnowledgeGraphLinkLucide artifactId={knowledgeGraphArtifact.id} />
                              </div>
                            )}
                            {jsonArtifact && (
                              <div className="my-4">
                                <JsonLinkLucide artifactId={jsonArtifact.id} />
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    <div className="mt-2 flex gap-2">
                      {/* Debug buttons - only show in development */}
                      {process.env.NODE_ENV === 'development' && (
                        <button
                          onClick={() => {
                            const messageArtifacts = getMessageArtifacts(message);
                            console.log('Message Debug Data:', {
                              message,
                              content: message.content,
                              thinking: messageWithThinking.thinking,
                              artifacts: messageArtifacts.map(artifact => ({
                                id: artifact.id,
                                artifactId: artifact.artifactId,
                                type: artifact.type,
                                title: artifact.title,
                                content: artifact.content,
                                position: artifact.position,
                                language: artifact.language
                              }))
                            });
                          }}
                          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                        >
                          Debug Info
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100">{message.content}</div>
                )}
              </div>
            </div>
          );
        })}
        <div className="h-8 flex items-center px-6 mb-24">
          <BrainWaveCharm isLoading={isLoading} />
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
};

// Bibliography link component with Lucide
export const BibliographyLinkLucide: React.FC<{ artifactId: string }> = ({ artifactId }) => {
  const chatStore = useChatStore();
  const { selectArtifact } = chatStore;
  const artifact = chatStore.artifacts.find(a => a.id === artifactId);
  const title = artifact?.title || "Bibliography";
  
  return (
    <button
      onClick={() => selectArtifact(artifactId)}
      className="inline-flex items-center gap-3 px-3 py-2 
                bg-blue-50 hover:bg-blue-100
                text-blue-700
                dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-800/40
                rounded-lg border border-blue-200 dark:border-blue-800
                shadow-[0_2px_4px_rgba(59,130,246,0.1)] hover:shadow-[0_4px_6px_rgba(59,130,246,0.15)]
                transition-all duration-200
                min-w-[50%] max-w-full"
      data-artifact-id={artifactId}
      data-artifact-type="application/vnd.bibliography"
    >
      <div className="flex-shrink-0 p-2 border-r border-blue-200 dark:border-blue-800">
        <Library className="w-6 h-6" />
      </div>
      <div className="flex flex-col items-start min-w-0">
        <span className="text-sm font-medium truncate w-full">{title}</span>
        <span className="text-xs text-blue-500 dark:text-blue-400">Click to open</span>
      </div>
    </button>
  );
};

// Knowledge Graph link component with Lucide
export const KnowledgeGraphLinkLucide: React.FC<{ artifactId: string }> = ({ artifactId }) => {
  const chatStore = useChatStore();
  const { selectArtifact } = chatStore;
  const artifact = chatStore.artifacts.find(a => a.id === artifactId);
  const title = artifact?.title || "Knowledge Graph";
  
  return (
    <button
      onClick={() => selectArtifact(artifactId)}
      className="inline-flex items-center gap-3 px-3 py-2 
                bg-slate-200 hover:bg-slate-300
                text-slate-700
                rounded-lg border border-slate-300
                shadow-[0_2px_4px_rgba(148,163,184,0.1)] hover:shadow-[0_4px_6px_rgba(148,163,184,0.15)]
                transition-all duration-200
                min-w-[50%] max-w-full"
      data-artifact-id={artifactId}
      data-artifact-type="application/vnd.knowledge-graph"
    >
      <div className="flex-shrink-0 p-2 border-r border-slate-300">
        <Network className="w-6 h-6" />
      </div>
      <div className="flex flex-col items-start min-w-0">
        <span className="text-sm font-medium truncate w-full">{title}</span>
        <span className="text-xs text-slate-500">Click to open</span>
      </div>
    </button>
  );
};

// JSON link component with Lucide
export const JsonLinkLucide: React.FC<{ artifactId: string }> = ({ artifactId }) => {
  const chatStore = useChatStore();
  const { selectArtifact } = chatStore;
  const artifact = chatStore.artifacts.find(a => a.id === artifactId);
  const title = artifact?.title || "JSON Data";
  
  return (
    <button
      onClick={() => selectArtifact(artifactId)}
      className="inline-flex items-center gap-3 px-3 py-2 
                bg-amber-100 hover:bg-amber-200
                text-amber-700
                rounded-lg border border-amber-200
                shadow-[0_2px_4px_rgba(217,119,6,0.1)] hover:shadow-[0_4px_6px_rgba(217,119,6,0.15)]
                transition-all duration-200
                min-w-[50%] max-w-full"
      data-artifact-id={artifactId}
      data-artifact-type="application/json"
    >
      <div className="flex-shrink-0 p-2 border-r border-amber-200">
        <FileText className="w-6 h-6" />
      </div>
      <div className="flex flex-col items-start min-w-0">
        <span className="text-sm font-medium truncate w-full">{title}</span>
        <span className="text-xs text-amber-500">Click to open</span>
      </div>
    </button>
  );
};
