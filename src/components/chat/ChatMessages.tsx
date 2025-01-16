import React from 'react';
import { Message } from '../../types/chat';
import { useChatStore } from '../../store/chatStore';

export const ChatMessages: React.FC<{ messages: Message[] }> = ({ messages }) => {
  const { selectArtifact } = useChatStore();
  
  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'} mb-4`}
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
    </div>
  );
};
