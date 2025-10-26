import React, { useRef, useEffect, KeyboardEvent, useState, ClipboardEvent } from 'react';
import { useChatStore } from '../../store/chatStore';
import { useProjectStore } from '../../store/projectStore';
import { APIStorageService } from '../../services/fileManagement/APIStorageService';

interface ProjectChatInputProps {
  storageService: APIStorageService;
  onBack?: () => void;
}

export const ProjectChatInput: React.FC<ProjectChatInputProps> = ({ storageService, onBack }) => {
  const chatInput = useChatStore(state => state.chatInput);
  const updateChatInput = useChatStore(state => state.updateChatInput);
  const addMessage = useChatStore(state => state.addMessage);
  const processMessage = useChatStore(state => state.processMessage);
  const createNewChat = useChatStore(state => state.startNewConversation);
  const setProjectConversationFlow = useChatStore(state => state.setProjectConversationFlow);
  const isLoading = useChatStore(state => state.isLoading);
  const { selectedProjectId } = useProjectStore();
  const addConversationToProject = useProjectStore(state => state.addConversationToProject);
  
  const [localInput, setLocalInput] = useState(chatInput);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (chatInput !== localInput) {
      setLocalInput(chatInput);
    }
  }, [chatInput]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`; // Smaller max height for project view
    }
  }, [localInput]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedUpdate = (value: string) => {
    setLocalInput(value);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      updateChatInput(value, false);
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localInput.trim()) return;

    // Store the input content before clearing
    const inputContent = localInput;

    // Clear the input immediately when user submits
    debouncedUpdate('');

    if (selectedProjectId) {
      const conversationName = `Conversation ${new Date().toLocaleString()}`;
      const conversationId = createNewChat(conversationName);
      
      if (conversationId) {
        addConversationToProject(selectedProjectId, conversationId, conversationName);
        addMessage({
          role: 'user',
          content: inputContent
        });
        
        // Set the flag to indicate we're continuing a project conversation
        // This prevents creating a new conversation for follow-up messages
        setProjectConversationFlow(true);
        
        onBack?.();
        try {
          await processMessage(inputContent);
        } catch (error) {
          console.error('Error processing message:', error);
        }
      }
    }
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          ref={textareaRef}
          value={localInput}
          onChange={(e) => debouncedUpdate(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={isLoading}
          className={`w-full p-3 
                   border border-gray-200 dark:border-gray-700
                   rounded-lg
                   focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   font-mono text-sm
                   resize-none
                   min-h-[48px]
                   ${isLoading 
                     ? 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
                     : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                   }`}
          placeholder={
            isLoading 
              ? "Processing your message..."
              : "Type a message... (Enter to send, Shift+Enter for new line)"
          }
        />
      </form>
    </div>
  );
}; 