import React, { useEffect, useRef, useState } from 'react';
import { Message } from '../../types/chat';
import { useChatStore } from '../../store/chatStore';
import { AssistantMarkdown } from './AssistantMarkdown';

// Remove or set to a past date to enable copy buttons for all messages
// const COPY_FEATURE_START_DATE = new Date('2000-01-01');

interface MessageWithThinking extends Message {
  thinking?: string;
}

export const ChatMessages: React.FC<{ messages: Message[] }> = ({ messages }) => {
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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here if you want
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
                  {message.artifactId && (
                    <button
                      onClick={() => selectArtifact(message.artifactId ?? null)}
                      className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View Artifact
                    </button>
                  )}
                </>
              ) : (
                <div className="whitespace-pre-wrap break-words">{message.content}</div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
};
