import React, { useRef, useEffect, KeyboardEvent, useState, ClipboardEvent } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useProjectStore } from '../../store/projectStore';
import { APIStorageService } from '../../services/fileManagement/APIStorageService';
import { useFileReference } from '../../hooks/useFileReference';
import { FileReferencePopup } from '../fileReference/FileReferencePopup';
import { useGraphReference } from '../../hooks/useGraphReference';
import { GraphReferencePopup } from '../graphReference/GraphReferencePopup';
import { FileEntry } from '@charm-mcp/shared';
import { FileUpload } from './FileUpload';
import { FileAttachments } from './FileAttachments';
import { FileAttachment } from '@charm-mcp/shared';
import { GraphItem } from '../../types/graphReference';

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
  const currentConversationId = useChatStore(state => state.currentConversationId);
  const conversations = useChatStore(state => state.conversations);
  const isLoading = useChatStore(state => state.isLoading);
  const { selectedProjectId } = useProjectStore();

  // Graph Mode detection
  const currentConversation = currentConversationId ? conversations[currentConversationId] : null;
  const isGraphModeConversation = currentConversation?.metadata.mode === 'graph_mode';

  // ADDING THIS FOR TESTING
  useEffect(() => {
    const defaultText = '';
    updateChatInput(defaultText, false);
    setLocalInput(defaultText);
  }, []);


  const addConversationToProject = useProjectStore(state => state.addConversationToProject);

  // Local state for input to debounce updates to the store
  const [localInput, setLocalInput] = useState(chatInput);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // File attachments state
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  // Update local input when chatInput changes from elsewhere
  useEffect(() => {
    if (chatInput !== localInput) {
      setLocalInput(chatInput);
    }
  }, [chatInput]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    fileRefState: { isActive, query, position },
    handleInputChange: handleFileRefInputChange,
    handleFileSelect,
    closeFileRef
  } = useFileReference({
    inputRef: textareaRef as React.RefObject<HTMLTextAreaElement>,
    onFileSelect: (file: FileEntry, position: number) => {
      const before = localInput.slice(0, position - query.length - 1); // -1 for @
      const after = localInput.slice(position);
      const newInput = `${before}@${file.name}${after}`;
      handleInputChange(newInput);
    }
  });

  // Graph reference hook (only in Graph Mode)
  const {
    graphRefState,
    handleInputChange: handleGraphRefInputChange,
    handleItemSelect: handleGraphItemSelect,
    closeGraphRef,
    graphData,
    loading: graphLoading,
    error: graphError
  } = useGraphReference({
    inputRef: textareaRef as React.RefObject<HTMLTextAreaElement>,
    conversationId: isGraphModeConversation ? currentConversationId : null,
    onItemSelect: (item: GraphItem, position: number) => {
      // Get current cursor position
      const cursorPosition = textareaRef.current?.selectionStart || localInput.length;
      // Find the last @ symbol before cursor
      const textBeforeCursor = localInput.slice(0, cursorPosition);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      
      
      if (lastAtIndex === -1) {
        // No @ found, just insert at cursor
        const before = localInput.slice(0, cursorPosition);
        const after = localInput.slice(cursorPosition);
        const insertText = item.type === 'node' 
          ? `${item.name} (${item.id})` 
          : `@${item.name}`;
        const newInput = `${before}${insertText}${after}`;
        handleInputChange(newInput);
      } else {
        // Replace from @ to cursor
        const before = localInput.slice(0, lastAtIndex);
        const after = localInput.slice(cursorPosition);
        const insertText = item.type === 'node' 
          ? `${item.name} (${item.id})` 
          : `@${item.name}`;
        const newInput = `${before}${insertText}${after}`;
        handleInputChange(newInput);
      }
    }
  });

  // Update the input handling to be immediate instead of debounced
  const handleInputChange = (value: string) => {
    setLocalInput(value);
    
    // Handle graph references (only in Graph Mode) - takes precedence over file references
    if (isGraphModeConversation) {
      handleGraphRefInputChange(value);
    } else {
      handleFileRefInputChange(value);
    }
    
    updateChatInput(value, false);
  };

  // File upload handlers
  const handleFilesUploaded = (newFiles: FileAttachment[]) => {
    setAttachments(prev => {
      const updated = [...prev, ...newFiles];
      return updated;
    });
  };

  const handleRemoveAttachment = (fileId: string) => {
    setAttachments(prev => prev.filter(f => f.id !== fileId));
  };

  const handleEditVarName = (fileId: string, newVarName: string) => {
    setAttachments(prev => prev.map(f => 
      f.id === fileId ? { ...f, varName: newVarName } : f
    ));
  };

  const handleViewAsArtifact = async (attachment: FileAttachment) => {
    try {
      const createArtifactFromAttachment = useChatStore.getState().createArtifactFromAttachment;
      const artifactId = await createArtifactFromAttachment(attachment, storageService);
      
      if (artifactId) {
        // Select the artifact and show the artifact window
        const selectArtifact = useChatStore.getState().selectArtifact;
        selectArtifact(artifactId);
      }
    } catch (error) {
      console.error('Error viewing attachment as artifact:', error);
    }
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

    // Store the input content before clearing
    const inputContent = localInput;
    const inputAttachments = [...attachments];

    // Clear the input and attachments immediately when user submits
    handleInputChange('');
    setAttachments([]);

    // Get the project conversation flow state
    const inProjectConversationFlow = useChatStore.getState().inProjectConversationFlow;

    // Only create a new conversation if we have a project ID AND we're not continuing a flow
    if (selectedProjectId && !inProjectConversationFlow) {
      const conversationId = createNewChat();
      if (conversationId) {
        addConversationToProject(selectedProjectId, conversationId, `Project Chat ${new Date().toLocaleString()}`);

        // Add user message to chat store first
        addMessage({
          role: 'user',
          content: inputContent,
          attachments: inputAttachments.length > 0 ? inputAttachments : undefined
        });

        // Transition to chat interface immediately
        onBack?.();

        try {
          await processMessage(inputContent, inputAttachments.length > 0 ? inputAttachments : undefined);
        } catch (error) {
          console.error('ChatInput: Error processing message:', error);
        }
      }
    } else {
      // Get current conversation state
      const currentConversationId = useChatStore.getState().currentConversationId;

      // Only create a new chat if there isn't an active conversation
      if (!currentConversationId) {
        createNewChat();
      }

      // Add message to current conversation (either existing or newly created)
      addMessage({
        role: 'user',
        content: inputContent,
        attachments: inputAttachments.length > 0 ? inputAttachments : undefined
      });

      try {
        await processMessage(inputContent, inputAttachments.length > 0 ? inputAttachments : undefined);
      } catch (error) {
        console.error('ChatInput: Error processing message:', error);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't submit if graph reference popup is active
    if (e.key === 'Enter' && !e.shiftKey && !graphRefState.isActive) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handlePaste = async (_e: ClipboardEvent<HTMLTextAreaElement>) => {
    // Just let the default paste behavior work
    // No special handling needed
  };


  return (
    <div className="sticky bottom-0 bg-gray-200 dark:bg-gray-900 shadow-lg">
      <div className="w-full max-w-4xl mx-auto px-4 relative">
        
        {/* File attachments display */}
        {attachments.length > 0 && (
          <div className="py-3 border-b border-gray-300 dark:border-gray-600">
            <FileAttachments
              attachments={attachments}
              onRemove={handleRemoveAttachment}
              onEditVarName={handleEditVarName}
              onViewAsArtifact={handleViewAsArtifact}
              editable={true}
              showVarNames={true}
            />
          </div>
        )}
        
        <div className="flex relative">
        {/* File Reference Popup (only when NOT in Graph Mode) */}
        {!isGraphModeConversation && isActive && position && selectedProjectId ? (
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

        {/* Graph Reference Popup (only in Graph Mode) */}
        {(() => {
          const shouldShow = isGraphModeConversation && graphRefState.isActive && graphRefState.position;
          return shouldShow && graphRefState.position ? (
            <GraphReferencePopup
              query={graphRefState.query}
              position={graphRefState.position}
              graphData={graphData}
              onSelect={handleGraphItemSelect}
              onClose={closeGraphRef}
              loading={graphLoading}
              error={graphError}
            />
          ) : null;
        })()}

        <form onSubmit={handleSubmit} className="relative w-full flex items-end">
          <div className="flex-shrink-0 pb-3">
            <FileUpload
              storageService={storageService}
              onFilesUploaded={handleFilesUploaded}
              className="relative"
            />
          </div>
          <textarea
            ref={textareaRef}
            value={localInput}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={isLoading}
            className={`w-full min-h-[96px] p-3 
                     border border-stone-200/80 dark:border-gray-600/80 
                     rounded-t-xl rounded-b-none
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     font-mono text-base
                     block align-bottom m-0
                     leading-normal
                     resize-none
                     shadow-inner
                     ${isLoading 
                       ? 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                       : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                     }`}
            placeholder={
              isLoading 
                ? "Processing your message..."
                : isGraphModeConversation 
                  ? "Type a message... (Enter to send, Shift+Enter for new line, @ to reference files or nodes)"
                  : "Type a message... (Enter to send, Shift+Enter for new line, @ to reference files)"
            }
          />
        </form>
        </div>
      </div>
    </div>
  );
};