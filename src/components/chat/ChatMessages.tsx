import React, { useEffect, useRef, useState } from 'react';
import { MessageWithThinking } from '../../types/chat';
import { useChatStore } from '../../store/chatStore';
import { AssistantMarkdown } from './AssistantMarkdown';
import { ClipboardIcon } from '@heroicons/react/24/solid';
import BrainWaveCharm from '../animations/BrainWaveCharm';

// Remove or set to a past date to enable copy buttons for all messages
// const COPY_FEATURE_START_DATE = new Date('2000-01-01');

export const ChatMessages: React.FC<{ messages: MessageWithThinking[] }> = ({ messages }) => {
  const { selectArtifact, isLoading, streamingMessageId, streamingContent, artifacts } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<string | null>(null);
  const [showThinkingMap, setShowThinkingMap] = useState<Record<string, boolean>>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  
  // Function to get all artifacts associated with a message
  const getMessageArtifacts = (message: MessageWithThinking) => {
    // Step 1: Get directly linked artifacts
    const linkedArtifacts = message.artifactId ? 
      artifacts.filter(a => a.id === message.artifactId) : [];
    
    // Step 2: Get artifacts that reference this message
    const referencedArtifacts = artifacts.filter(a => a.artifactId === message.id);
    
    // Step 3: Get artifacts referenced in message content via buttons
    const contentReferencedArtifacts = (() => {
      // Extract artifact IDs from button data attributes in content
      const artifactIdRegex = /data-artifact-id="([^"]+)"/g;
      const matches = [...message.content.matchAll(artifactIdRegex)];
      const contentArtifactIds = matches.map(match => match[1]);
      
      // Get artifacts with these IDs
      return artifacts.filter(a => contentArtifactIds.includes(a.id));
    })();
    
    // Step 4: Combine all unique artifacts and sort by position
    const allArtifacts = [...new Set([...linkedArtifacts, ...referencedArtifacts, ...contentReferencedArtifacts])]
      .sort((a, b) => a.position - b.position);
    
    return allArtifacts;
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
      console.log('Successfully copied to clipboard');
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div ref={containerRef} className="w-full max-w-3xl mx-auto px-4 pt-6">
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
                    : 'bg-gradient-to-b from-[#1E40AF] to-[#2563EB] text-white shadow-[#1E40AF]/10'
                }`}
              >
                {isAssistant && (
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
                        <AssistantMarkdown 
                          content={isStreaming ? streamingContent : message.content} 
                        />
                        {isStreaming && (
                          <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse" />
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
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
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        Debug Info
                      </button>
                      {/* {message.artifactId && (
                        <button
                          onClick={() => {
                            console.log('ChatMessages: View Artifact clicked with artifactId:', message.artifactId);
                            selectArtifact(message.artifactId ?? null);
                          }}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View Artifact
                        </button>
                      )} */}
                    </div>
                  </>
                ) : (
                  <div className="whitespace-pre-wrap break-words">{message.content}</div>
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
