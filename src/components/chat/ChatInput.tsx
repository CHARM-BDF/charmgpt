import React, { useRef, useEffect, KeyboardEvent, useState, ClipboardEvent } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useProjectStore } from '../../store/projectStore';
import { APIStorageService } from '../../services/fileManagement/APIStorageService';

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
  
  // Debounced update function
  const debouncedUpdate = (value: string) => {
    setLocalInput(value);
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set a new timeout
    timeoutRef.current = setTimeout(() => {
      updateChatInput(value, false);
    }, 300); // 300ms debounce
  };
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    
    // If we're in a project view, create a new conversation and transition
    if (selectedProjectId) {
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
      // Regular chat flow without project
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
    debouncedUpdate('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardData = e.clipboardData;
    const htmlContent = clipboardData.getData('text/html');
    const plainText = clipboardData.getData('text/plain');
    const content = htmlContent || plainText;

    // Only save if content is longer than 500 characters and we have a selected project
    if (content.length > 500 && selectedProjectId) {
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
      const fileName = `Pasted text ${timestamp}`;

      try {
        const metadata = {
          description: fileName,
          schema: {
            type: 'json' as const,
            format: htmlContent ? 'text/html' : 'text/plain',
            encoding: 'utf-8',
            sampleData: ''
          },
          origin: {
            type: 'upload' as const,
            timestamp: new Date()
          }
        };

        // Add project tag to the metadata before sending
        const metadataWithTags = {
          ...metadata,
          tags: [`project:${selectedProjectId}`]
        };

        await storageService.createFile(content, metadataWithTags);

        // Add a message to the chat indicating the file was saved
        processMessage(`Saved pasted content as file: ${fileName}`);
      } catch (error) {
        console.error('Error saving pasted content:', error);
      }
    }
  };

  return (
    <div className="sticky bottom-0 bg-gray-200 dark:bg-gray-900 shadow-lg">
      <div className="w-full max-w-4xl mx-auto px-4 flex">
        <form onSubmit={handleSubmit} className="relative w-full flex">
          <textarea
            ref={textareaRef}
            value={localInput}
            onChange={(e) => debouncedUpdate(e.target.value)}
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
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          />
        </form>
      </div>
    </div>
  );
};