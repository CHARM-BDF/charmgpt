import React, { useEffect, useRef, useState } from 'react';
import { MessageWithThinking } from '../../types/chat';
import { useChatStore } from '../../store/chatStore';
import { AssistantMarkdown } from './AssistantMarkdown';

// Remove or set to a past date to enable copy buttons for all messages
// const COPY_FEATURE_START_DATE = new Date('2000-01-01');

export const ChatMessages: React.FC<{ messages: MessageWithThinking[] }> = ({ messages }) => {
  const { selectArtifact } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<string | null>(null);
  const [showThinkingMap, setShowThinkingMap] = useState<Record<string, boolean>>({});
  
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

  /**
   * CRITICAL: Copy Functionality
   * This function provides essential clipboard functionality for messages
   * DO NOT REMOVE: Required for user experience and accessibility
   */
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log('Successfully copied to clipboard');
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div ref={containerRef} className="w-full space-y-6">
      {messages.map((message) => {
        const messageWithThinking = message as MessageWithThinking;
        const isAssistant = message.role === 'assistant';
        const hasThinking = isAssistant && messageWithThinking.thinking;
        
        return (
          <div
            key={message.id}
            className={`flex ${isAssistant ? 'justify-start' : 'justify-start'}`}
          >
            <div
              className={`w-full max-w-3xl rounded-lg p-6 shadow-sm ${
                isAssistant
                  ? 'bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 shadow-gray-100 dark:shadow-gray-900/20'
                  : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-500/10'
              }`}
            >
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
                  <AssistantMarkdown content={message.content} />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => console.log('Message Debug Data:', {
                        message,
                        content: message.content,
                        thinking: messageWithThinking.thinking,
                        artifactId: message.artifactId
                      })}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      Debug Info
                    </button>
                    {message.artifactId && (
                      <button
                        onClick={() => {
                          console.log('ChatMessages: View Artifact clicked with artifactId:', message.artifactId);
                          selectArtifact(message.artifactId ?? null);
                        }}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        View Artifact
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-grow">
                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(message.content)}
                    className="ml-2 p-1 text-gray-500 hover:text-gray-700"
                    title="Copy message"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                      <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
};
