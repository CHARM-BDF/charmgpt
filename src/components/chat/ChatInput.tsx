import React, { useState } from 'react';
import { useChatStore } from '../../store/chatStore';

export const ChatInput: React.FC = () => {
  const [input, setInput] = useState('create a bunch of text that will test all of the markdown formats including two different types of code.');
  const { addMessage, processMessage } = useChatStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    console.log('ChatInput: Submitting message:', input);
    
    try {
      await processMessage(input);
      console.log('ChatInput: Message processed successfully');
    } catch (error) {
      console.error('ChatInput: Error processing message:', error);
    }
    
    setInput('create a bunch of text that will test all of the markdown formats including two different types of code.');
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex space-x-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          placeholder="Type a message..."
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 dark:hover:bg-blue-400"
        >
          Send
        </button>
      </div>
    </form>
  );
};
