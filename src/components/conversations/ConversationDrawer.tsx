import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import { ConversationList } from './ConversationList';
// @ts-ignore - Heroicons type definitions mismatch
import { SparklesIcon } from '@heroicons/react/24/outline';

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
        className="fixed left-0 top-[88px] w-5 h-[calc(100vh-96px)] z-40"
      />
      
      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed left-0 top-[88px] h-[calc(100vh-96px)] bg-white dark:bg-gray-800 shadow-lg 
                   transition-transform duration-300 ease-in-out z-50
                   ${isOpen ? 'translate-x-0' : 'translate-x-[-95%]'}
                   border-r border-gray-200 dark:border-gray-700
                   rounded-tr-xl rounded-br-xl
                   w-72`}
      >
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Conversations
            </h2>
            <button
              onClick={() => startNewConversation()}
              className="p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100
                       hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors
                       flex items-center gap-1"
              title="New Conversation"
            >
              <span className="w-4 h-4 flex items-center justify-center bg-gray-200 dark:bg-gray-600 rounded-full">
                <span className="text-sm font-semibold leading-none">+</span>
              </span>
              <SparklesIcon className="w-5 h-5" />
            </button>
          </div>
          
          {/* Conversation list */}
          <div className="h-[calc(100vh-224px)] overflow-y-auto">
            <ConversationList />
          </div>
        </div>
        
        {/* Hint text when drawer is closed */}
        <div className={`absolute right-0 top-1/2 -translate-y-1/2 transition-opacity duration-300
                      ${isOpen ? 'opacity-0' : 'opacity-100'}`}>
          <div className="rotate-90 whitespace-nowrap text-xs text-gray-400 dark:text-gray-500">
            Conversations
          </div>
        </div>
      </div>
    </>
  );
}; 