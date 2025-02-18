import React from 'react';
import { useModelStore } from '../../store/modelStore';

export const ModelSelector: React.FC = () => {
  const { selectedModel, setSelectedModel } = useModelStore();

  const handleModelSelect = (model: 'claude' | 'ollama') => {
    console.log(`ModelSelector: Switching from ${selectedModel} to ${model}`);
    setSelectedModel(model);
  };

  return (
    <div className="flex items-center space-x-4">
      {/* Claude */}
      <div className="flex flex-col items-center">
        <div className="flex items-center">
          <button
            onClick={() => handleModelSelect('claude')}
            className={`p-2 rounded-full transition-colors ${
              selectedModel === 'claude'
                ? 'bg-blue-100 dark:bg-blue-900/30'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Use Claude"
          >
            <img 
              src="/logos/claude_logo.png" 
              alt="Claude" 
              className="w-5 h-5"
            />
          </button>
        </div>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Claude</span>
      </div>

      {/* Ollama */}
      <div className="flex flex-col items-center">
        <div className="flex items-center">
          <button
            onClick={() => handleModelSelect('ollama')}
            className={`p-2 rounded-full transition-colors ${
              selectedModel === 'ollama'
                ? 'bg-blue-100 dark:bg-blue-900/30'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Use Ollama"
          >
            <img 
              src="/logos/ollama_logo.png" 
              alt="Ollama" 
              className="w-5 h-5"
            />
          </button>
        </div>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Ollama</span>
      </div>
    </div>
  );
}; 