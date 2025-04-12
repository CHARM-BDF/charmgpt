import React, { useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { Conversation } from '../../types/chat';
import { getRelativeTimeString } from '../../utils/dateUtils';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onSelect,
  onRename,
  onDelete
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(conversation.metadata.name);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editedName.trim()) {
        onRename(editedName.trim());
        setIsEditing(false);
      }
    } else if (e.key === 'Escape') {
      setEditedName(conversation.metadata.name);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    if (editedName.trim() && editedName !== conversation.metadata.name) {
      onRename(editedName.trim());
    } else {
      setEditedName(conversation.metadata.name);
    }
    setIsEditing(false);
  };

  return (
    <div 
      className={`p-3 rounded-lg cursor-pointer transition-colors duration-200
                  ${isActive 
                    ? 'bg-blue-50 dark:bg-blue-900/20' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
      onClick={onSelect}
    >
      <div className="flex justify-between items-center">
        {isEditing ? (
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="flex-1 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 
                     rounded text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 
                     focus:ring-blue-500 dark:focus:ring-blue-400"
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <span 
            className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate flex-1"
          >
            {conversation.metadata.name}
          </span>
        )}
        <div className="flex space-x-2 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleStartEdit(e);
            }}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {conversation.metadata.messageCount} messages • 
        {getRelativeTimeString(new Date(conversation.metadata.created))}
      </div>
    </div>
  );
};

export const ConversationList: React.FC = () => {
  const { conversations, currentConversationId, switchConversation, renameConversation, deleteConversation } = useChatStore();
  
  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      deleteConversation(id);
    }
  };

  return (
    <div className="space-y-2">
      {Object.entries(conversations).map(([id, conversation]) => (
        <ConversationItem
          key={id}
          conversation={conversation}
          isActive={id === currentConversationId}
          onSelect={() => switchConversation(id)}
          onRename={(newName) => renameConversation(id, newName)}
          onDelete={() => handleDelete(id)}
        />
      ))}
    </div>
  );
}; 