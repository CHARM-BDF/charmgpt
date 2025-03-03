import React, { useRef, useEffect, KeyboardEvent, useState } from 'react';
import { useChatStore } from '../../store/chatStore';

export const ChatInput: React.FC = () => {
  // Use selector functions to only subscribe to the specific state we need
  const chatInput = useChatStore(state => state.chatInput);
  const updateChatInput = useChatStore(state => state.updateChatInput);
  const addMessage = useChatStore(state => state.addMessage);
  const processMessage = useChatStore(state => state.processMessage);
  
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
    
    // Add user message to chat store first
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
    // think deeply about it and the choose a sacred geometry to create an svg to display in the artifact window. Explain why you chose that one. 
// write python that will simulate rolling 3 7 sided die 1000 times and make a histogram to show the results. 
// setInput('do that again.');
// setInput('look up 3 papers on the gene DYRK1A and provide a summary.');
// setInput('make a meal plan for a week of lunches that can be packed for a teenager to take to school, describe but make an artifact for the final plan and number it the version after the last one.');
    // setInput('create a bunch of text that will test all of the markdown formats including two different types of code. Include a table.');
    // setInput('create a bunch of text that will test all of the markdown formats including two different types of code. And include an artifact of a sacred geometry svg.');
    // setInput('think deeply about it and the choose a sacred geometry to create an svg to display in the artifact window. Explain why you chose that one.');
// Use medik to find the nodes that are related_to NCBIGene:1859

  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
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
