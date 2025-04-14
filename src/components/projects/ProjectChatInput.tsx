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

    if (selectedProjectId) {
      const conversationName = `Conversation ${new Date().toLocaleString()}`;
      const conversationId = createNewChat(conversationName);
      
      if (conversationId) {
        addConversationToProject(selectedProjectId, conversationId, conversationName);
        addMessage({
          role: 'user',
          content: localInput
        });
        onBack?.();
        try {
          await processMessage(localInput);
        } catch (error) {
          console.error('Error processing message:', error);
        }
      }
    }
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
          },
          tags: [`project:${selectedProjectId}`]
        };

        await storageService.createFile(content, metadata);
        processMessage(`Saved pasted content as file: ${fileName}`);
      } catch (error) {
        console.error('Error saving pasted content:', error);
      }
    }
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
          className="w-full p-3 
                   border border-gray-200 dark:border-gray-700
                   rounded-lg
                   focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   font-mono text-sm
                   bg-white dark:bg-gray-800 
                   text-gray-900 dark:text-gray-100
                   resize-none
                   min-h-[48px]"
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
        />
      </form>
    </div>
  );
}; 