import React from 'react';
import { useModelStore } from '../../store/modelStore';

// Define the model type from the store for TypeScript
type ModelType = 'anthropic' | 'ollama' | 'openai' | 'gemini';

// Create a reusable ModelButton component for consistency
interface ModelButtonProps {
  model: ModelType;
  label: string;
  icon: string;
  selectedModel: ModelType;
  onSelect: (model: ModelType) => void;
}

const ModelButton: React.FC<ModelButtonProps> = ({ 
  model, 
  label, 
  icon, 
  selectedModel, 
  onSelect 
}) => {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center">
        <button
          onClick={() => onSelect(model)}
          className={`p-2 rounded-full transition-colors ${
            selectedModel === model
              ? 'bg-blue-100 dark:bg-blue-900/30'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title={`Use ${label}`}
        >
          <img 
            src={icon} 
            alt={label} 
            className={`w-5 h-5 object-contain ${
              model === 'gemini' || model === 'ollama' ? 'scale-125' : 
              model === 'anthropic' ? 'scale-110' : ''
            }`}
          />
        </button>
      </div>
      <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{label}</span>
    </div>
  );
};

export const ModelSelector: React.FC = () => {
  const { selectedModel, setSelectedModel } = useModelStore();

  const handleModelSelect = (model: ModelType) => {
    console.log(`ModelSelector: Switching from ${selectedModel} to ${model}`);
    setSelectedModel(model);
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
      {models.map(model => (
        <ModelButton
          key={model.id}
          model={model.id}
          label={model.name}
          icon={model.logo}
          selectedModel={selectedModel}
          onSelect={handleModelSelect}
        />
      ))}
    </div>
  );
}; 