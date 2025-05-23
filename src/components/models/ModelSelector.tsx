import React, { useState, useEffect } from 'react';
import { useModelStore } from '../../store/modelStore';
import { fetchApiKeyStatus, hasApiKey } from '../../utils/apiKeyChecker';

// Define the model type from the store for TypeScript
type ModelType = 'anthropic' | 'ollama' | 'openai' | 'gemini';

interface ApiKeyStatus {
  anthropic: boolean;
  openai: boolean;
  gemini: boolean;
  ollama: boolean;
}

// Create a reusable ModelButton component for consistency
interface ModelButtonProps {
  model: ModelType;
  label: string;
  icon: string;
  selectedModel: ModelType;
  onSelect: (model: ModelType) => void;
  isAvailable: boolean;
}

const ModelButton: React.FC<ModelButtonProps> = ({ 
  model, 
  label, 
  icon, 
  selectedModel, 
  onSelect,
  isAvailable
}) => {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center">
        <button
          onClick={() => isAvailable && onSelect(model)}
          disabled={!isAvailable}
          className={`p-2 rounded-full transition-colors ${
            !isAvailable 
              ? 'opacity-40 cursor-not-allowed' 
              : selectedModel === model
                ? 'bg-blue-100 dark:bg-blue-900/30'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title={isAvailable ? `Use ${label}` : `${label} - API key required`}
        >
          <img 
            src={icon} 
            alt={label} 
            className={`w-5 h-5 object-contain ${
              model === 'gemini' || model === 'ollama' ? 'scale-125' : 
              model === 'anthropic' ? 'scale-110' : ''
            } ${!isAvailable ? 'grayscale' : ''}`}
          />
        </button>
      </div>
      <span className={`text-[10px] mt-0.5 ${
        !isAvailable 
          ? 'text-gray-300 dark:text-gray-600' 
          : 'text-gray-400 dark:text-gray-500'
      }`}>
        {label}
      </span>
    </div>
  );
};

export const ModelSelector: React.FC = () => {
  const { selectedModel, setSelectedModel } = useModelStore();
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({
    anthropic: true, // Default to available until we check
    openai: true,
    gemini: true,
    ollama: true
  });

  // Fetch API key status on component mount
  useEffect(() => {
    const checkApiKeys = async () => {
      const status = await fetchApiKeyStatus();
      setApiKeyStatus(status);
    };
    
    checkApiKeys();
  }, []);

  const handleModelSelect = (model: ModelType) => {
    if (hasApiKey(model, apiKeyStatus)) {
      console.log(`ModelSelector: Switching from ${selectedModel} to ${model}`);
      setSelectedModel(model);
    } else {
      console.log(`ModelSelector: Cannot switch to ${model} - no API key`);
    }
  };

  // Define model data for consistent rendering
  const models = [
    {
      id: 'anthropic' as ModelType,
      name: 'Claude',
      logo: '/logos/claude_logo.png'
    },
    {
      id: 'openai' as ModelType,
      name: 'ChatGPT',
      logo: '/logos/openai_logo.png'
    },
    {
      id: 'gemini' as ModelType,
      name: 'Gemini',
      logo: '/logos/gemini_logo.svg'
    },
    {
      id: 'ollama' as ModelType,
      name: 'Ollama',
      logo: '/logos/ollama_logo.png'
    }
  ];

  return (
    <div className="flex items-center space-x-4">
      {models.map(model => {
        const modelIsAvailable = hasApiKey(model.id, apiKeyStatus);
        return (
          <ModelButton
            key={model.id}
            model={model.id}
            label={model.name}
            icon={model.logo}
            selectedModel={selectedModel}
            onSelect={handleModelSelect}
            isAvailable={modelIsAvailable}
          />
        );
      })}
    </div>
  );
}; 