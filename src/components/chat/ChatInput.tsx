import React, { useState } from 'react';
import { useChatStore } from '../../store/chatStore';

export const ChatInput: React.FC = () => {
  const [input, setInput] = useState('think about it seriously and then create an svg of a sacred geometry shape and include your reasoning for choosing that one. include three lines of code as a coode snippet to test formatting, but also create an artifact to test the ref tag');
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
    
    setInput('think about it seriously and then create an svg of a sacred geometry shape and include your reasoning for choosing that one. include three lines of code as a coode snippet to test formatting, but also create an artifact to test the ref tag');
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-white">
      <div className="flex space-x-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2"
          placeholder="Type a message..."
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
        >
          Send
        </button>
      </div>
    </form>
  );
};
