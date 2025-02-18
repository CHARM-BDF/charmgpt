import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { ConversationList } from './ConversationList';

export const ConversationDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const { startNewConversation } = useChatStore();
  
  // Track mouse position for drawer activation
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!drawerRef.current || !triggerRef.current) return;
      
      const triggerWidth = 20; // Width of trigger area in pixels
      if (e.clientX <= triggerWidth && !isOpen) {
        setIsOpen(true);
      } else if (e.clientX > 300 && isOpen && !drawerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [isOpen]);

  return (
    <>
      {/* Trigger area */}
      <div
        ref={triggerRef}
        className="fixed left-0 top-0 w-5 h-full z-40"
      />
      
      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed left-0 top-0 h-full bg-white dark:bg-gray-800 shadow-lg 
                   transition-transform duration-300 ease-in-out z-50
                   ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                   border-r border-gray-200 dark:border-gray-700
                   w-72`}
      >
        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Conversations
          </h2>
          
          {/* Conversation list */}
          <ConversationList />
          
          {/* New conversation button */}
          <button
            onClick={() => startNewConversation()}
            className="mt-4 w-full px-4 py-2 bg-blue-500 text-white rounded-lg
                     hover:bg-blue-600 transition-colors duration-200"
          >
            New Conversation
          </button>
        </div>
      </div>
    </>
  );
}; 