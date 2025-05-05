import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ModelType = 'claude' | 'ollama' | 'openai' | 'gemini';

interface ModelState {
  selectedModel: ModelType;
  setSelectedModel: (model: ModelType) => void;
}

export const useModelStore = create<ModelState>()(
  persist(
    (set, get) => ({
      selectedModel: 'claude' as ModelType,
      setSelectedModel: (model) => {
        const currentModel = get().selectedModel;
        console.log('ModelStore: State update', {
          previous: currentModel,
          new: model,
          timestamp: new Date().toISOString()
        });
        set({ selectedModel: model });
      },
    }),
    {
      name: 'model-storage',
    }
  )
); 