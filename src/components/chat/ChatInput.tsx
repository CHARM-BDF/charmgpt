import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useChatStore } from '../../store/chatStore';

export const ChatInput: React.FC = () => {
  // 
// look papers on the gene GNB1 and provide a summary
  // const [input, setInput] = useState('think deeply about it and the choose a sacred geometry to create an svg to display in the artifact window. Explain why you chose that one.');
  // const [input, setInput] = useState('create a bunch of text that will test all of the markdown formats including two different types of code. Include a table.');
  // const [input, setInput] = useState('make a meal plan for a week of lunches that can be packed for a teenager to take to school, describe but make an artifact for the final plan.');
  const [input, setInput] = useState('look up papers on the gene DYRK1A and provide a summary.');
  const { addMessage, processMessage } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea as content grows
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 400)}px`; // Max height of ~15 lines
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    console.log('ChatInput: Submitting message:', input);
    
    // Add user message to chat store first
    addMessage({
      role: 'user',
      content: input
    });
    
    try {
      await processMessage(input);
      console.log('ChatInput: Message processed successfully');
    } catch (error) {
      console.error('ChatInput: Error processing message:', error);
    }
    // think deeply about it and the choose a sacred geometry to create an svg to display in the artifact window. Explain why you chose that one. 

    setInput(' look up papers on the gene DYRK1A and provide a summary.');
    // setInput('make a meal plan for a week of lunches that can be packed for a teenager to take to school, describe but make an artifact for the final plan and number it the version after the last one.');
    // setInput('create a bunch of text that will test all of the markdown formats including two different types of code. Include a table.');
    // setInput('create a bunch of text that will test all of the markdown formats including two different types of code. And include an artifact of a sacred geometry svg.');
    // setInput('think deeply about it and the choose a sacred geometry to create an svg to display in the artifact window. Explain why you chose that one.');
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
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
