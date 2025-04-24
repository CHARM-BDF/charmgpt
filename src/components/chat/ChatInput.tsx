import React, { useRef, useEffect, KeyboardEvent, useState, ClipboardEvent } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useProjectStore } from '../../store/projectStore';
import { APIStorageService } from '../../services/fileManagement/APIStorageService';
import { useFileReference } from '../../hooks/useFileReference';
import { FileReferencePopup } from '../fileReference/FileReferencePopup';
import { FileEntry } from '../../types/fileManagement';

interface ChatInputProps {
  storageService: APIStorageService;
  onBack?: () => void;  // Add optional callback for transitioning back
}

export const ChatInput: React.FC<ChatInputProps> = ({ storageService, onBack }) => {
  // Use selector functions to only subscribe to the specific state we need
  const chatInput = useChatStore(state => state.chatInput);
  const updateChatInput = useChatStore(state => state.updateChatInput);
  const addMessage = useChatStore(state => state.addMessage);
  const processMessage = useChatStore(state => state.processMessage);
  const createNewChat = useChatStore(state => state.startNewConversation);
  const { selectedProjectId } = useProjectStore();
  
  useEffect(() => {
    console.log('Selected Project ID:', selectedProjectId);
  }, [selectedProjectId]);

  const addConversationToProject = useProjectStore(state => state.addConversationToProject);
  
  // Local state for input to debounce updates to the store
  const [localInput, setLocalInput] = useState(chatInput);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update local input when chatInput changes from elsewhere
  useEffect(() => {
    if (chatInput !== localInput) {
      setLocalInput(chatInput);
    }
  }, [chatInput]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    fileRefState: { isActive, query, position },
    handleInputChange: handleFileRefInputChange,
    handleFileSelect,
    closeFileRef
  } = useFileReference({
    inputRef: textareaRef,
    onFileSelect: (file: FileEntry, position: number) => {
      console.log('File selected:', file, 'at position:', position);
      const before = localInput.slice(0, position - query.length - 1); // -1 for @
      const after = localInput.slice(position);
      const newInput = `${before}@${file.name}${after}`;
      handleInputChange(newInput);
    }
  });
  
  // Update the input handling to be immediate instead of debounced
  const handleInputChange = (value: string) => {
    console.log('1. handleInputChange called with:', value);
    setLocalInput(value);
    console.log('2. About to call handleFileRefInputChange');
    handleFileRefInputChange(value);
    updateChatInput(value, false);
  };
  
  // Auto-resize textarea as content grows
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 400)}px`; // Max height of ~15 lines
    }
  }, [localInput]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInput.trim()) return;

    console.log('ChatInput: Submitting message:', localInput);
    
    // Get the project conversation flow state
    const inProjectConversationFlow = useChatStore.getState().inProjectConversationFlow;
    console.log('ChatInput: inProjectConversationFlow:', inProjectConversationFlow);
    
    // Only create a new conversation if we have a project ID AND we're not continuing a flow
    if (selectedProjectId && !inProjectConversationFlow) {
      const conversationId = createNewChat();
      if (conversationId) {
        addConversationToProject(selectedProjectId, conversationId, `Project Chat ${new Date().toLocaleString()}`);
        
        // Add user message to chat store first
        addMessage({
          role: 'user',
          content: localInput
        });

        // Transition to chat interface immediately
        onBack?.();
        
        try {
          await processMessage(localInput);
          console.log('ChatInput: Message processed successfully');
        } catch (error) {
          console.error('ChatInput: Error processing message:', error);
        }
      }
    } else {
      // Regular chat flow without project or continuing a project conversation
      addMessage({
        role: 'user',
        content: localInput
      });
      
      try {
        await processMessage(localInput);
        console.log('ChatInput: Message processed successfully');
      } catch (error) {
        console.error('ChatInput: Error processing message:', error);
      }
    }

    // Clear the input after sending
    handleInputChange('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    // Just let the default paste behavior work
    // No special handling needed
  };

  useEffect(() => {
    console.log('Popup condition values:', { isActive, position, selectedProjectId });
  }, [isActive, position, selectedProjectId]);

  return (
    <div className="sticky bottom-0 bg-gray-200 dark:bg-gray-900 shadow-lg">
      <div className="w-full max-w-4xl mx-auto px-4 flex relative">
        {/* Popup moved outside form but inside the container */}
        {isActive && position && selectedProjectId ? (
          <div 
            className="absolute z-[9999] bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700"
            style={{
              bottom: '120px',  // Position above the input
              left: '20px',
              width: '400px',
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '8px'  // Add some padding
            }}
          >
            <div className="text-sm font-medium text-gray-600 dark:text-gray-300 px-2 py-1 mb-1 border-b border-gray-100 dark:border-gray-700">
              Reference a file
            </div>
            <FileReferencePopup
              query={query}
              position={position}
              onSelect={handleFileSelect}
              onClose={closeFileRef}
              projectId={selectedProjectId}
              storageService={storageService}
            />
          </div>
        ) : null}
        
        <form onSubmit={handleSubmit} className="relative w-full flex">
          <textarea
            ref={textareaRef}
            value={localInput}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className="w-full min-h-[96px] p-3 
                     border border-stone-200/80 dark:border-gray-600/80 
                     rounded-t-xl rounded-b-none
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     font-mono text-base
                     bg-white dark:bg-gray-700 
                     text-gray-900 dark:text-gray-100
                     block align-bottom m-0
                     leading-normal
                     resize-none
                     shadow-inner"
            placeholder="Type a message... (Enter to send, Shift+Enter for new line, @ to reference files)"
          />
        </form>
      </div>
    </div>
  );
};