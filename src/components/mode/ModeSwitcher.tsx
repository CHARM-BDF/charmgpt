import React from 'react';
// @ts-ignore - Heroicons type definitions mismatch
import { DocumentTextIcon, BeakerIcon } from '@heroicons/react/24/outline';
import { useModeStore } from '../../store/modeStore';

export const ModeSwitcher: React.FC = () => {
  const { currentMode, setMode } = useModeStore();

  return (
    <div className="flex gap-2 p-2">
      <button
        onClick={() => setMode('grant')}
        className={`p-2 rounded-lg transition-colors flex items-center gap-2
                   ${currentMode === 'grant' 
                     ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                     : 'hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-700 dark:text-gray-300'}`}
        title="Grant Mode"
      >
        <DocumentTextIcon className="w-5 h-5" />
      </button>
      <button
        onClick={() => setMode('research')}
        className={`p-2 rounded-lg transition-colors flex items-center gap-2
                   ${currentMode === 'research' 
                     ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' 
                     : 'hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-700 dark:text-gray-300'}`}
        title="Research Mode"
      >
        <BeakerIcon className="w-5 h-5" />
      </button>
    </div>
  );
}; 