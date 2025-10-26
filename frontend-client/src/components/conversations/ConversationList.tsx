import React, { useState } from 'react';
import { useChatStore } from '../../store/chatStore';
import { Conversation } from '../../types/chat';
import { getRelativeTimeString } from '../../utils/dateUtils';

// Utility function to calculate conversation size
const getConversationSize = (conversation: Conversation): string => {
  try {
    const size = new Blob([JSON.stringify(conversation)]).size;
    if (size < 1024) {
      return `${size} B`;
    } else if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    } else {
      return `${(size / 1024 / 1024).toFixed(1)} MB`;
    }
  } catch (error) {
    return '? KB';
  }
};

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  isBulkEditMode?: boolean;
  isSelected?: boolean;
  onBulkSelect?: (selected: boolean) => void;
}

interface ConversationListProps {
  isBulkEditMode?: boolean;
  selectedConversationIds?: Set<string>;
  onConversationSelect?: (id: string, selected: boolean) => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onSelect,
  onRename,
  onDelete,
  isBulkEditMode = false,
  isSelected = false,
  onBulkSelect
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

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onBulkSelect?.(e.target.checked);
  };

  return (
    <div 
      className={`p-3 rounded-lg cursor-pointer transition-colors duration-200
                  ${isActive 
                    ? 'bg-blue-50 dark:bg-blue-900/20' 
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                  ${conversation.metadata.mode === 'graph_mode' 
                    ? 'border-l-4 border-l-purple-500 bg-purple-50/30 dark:bg-purple-900/10' 
                    : ''}`}
      onClick={isBulkEditMode ? undefined : onSelect}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 flex-1">
          {isBulkEditMode && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleCheckboxChange}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded 
                       focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 
                       focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          
          {/* Graph Mode indicator */}
          {conversation.metadata.mode === 'graph_mode' && (
            <img 
              src="/logos/graph_network_icon.svg" 
              alt="Graph Mode"
              className="w-4 h-4 opacity-70 flex-shrink-0" 
            />
          )}
          
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
            <div className="flex-1 flex items-center gap-2">
              <span 
                className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
              >
                {conversation.metadata.name}
              </span>
              {conversation.metadata.mode === 'graph_mode' && (
                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                  Graph
                </span>
              )}
            </div>
          )}
        </div>
        
        {!isBulkEditMode && (
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
        )}
      </div>
      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        <div>
          {conversation.metadata.messageCount} messages • 
          {getRelativeTimeString(new Date(conversation.metadata.created))}
        </div>
        <div className="text-xs opacity-75 mt-0.5">
          {getConversationSize(conversation)}
        </div>
      </div>
    </div>
  );
};

export const ConversationList: React.FC<ConversationListProps> = ({
  isBulkEditMode = false,
  selectedConversationIds = new Set(),
  onConversationSelect
}) => {
  const { conversations, currentConversationId, switchConversation, renameConversation, deleteConversation } = useChatStore();
  
  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      deleteConversation(id);
    }
  };

  // Sort conversations by lastUpdated time (most recent first)
  const sortedConversationEntries = Object.entries(conversations)
    .sort(([, a], [, b]) => {
      const aDate = new Date(a.metadata.lastUpdated);
      const bDate = new Date(b.metadata.lastUpdated);
      return bDate.getTime() - aDate.getTime(); // Most recent first
    });

  return (
    <div className="space-y-2">
      {sortedConversationEntries.map(([id, conversation]) => (
        <ConversationItem
          key={id}
          conversation={conversation}
          isActive={id === currentConversationId}
          onSelect={() => switchConversation(id)}
          onRename={(newName) => renameConversation(id, newName)}
          onDelete={() => handleDelete(id)}
          isBulkEditMode={isBulkEditMode}
          isSelected={selectedConversationIds.has(id)}
          onBulkSelect={(selected) => onConversationSelect?.(id, selected)}
        />
      ))}
    </div>
  );
}; 