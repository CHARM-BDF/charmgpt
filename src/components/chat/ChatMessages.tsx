import React, { useEffect, useRef } from 'react';
import { Message } from '../../types/chat';
import { useChatStore } from '../../store/chatStore';

export const ChatMessages: React.FC<{ messages: Message[] }> = ({ messages }) => {
  const { selectArtifact } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<string | null>(null);
  
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
          <div className={`max-w-3/4 rounded-lg p-4 ${
            message.role === 'assistant' 
              ? 'bg-white border border-gray-200' 
              : 'bg-blue-500 text-white'
          }`}>
            {message.content}
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
