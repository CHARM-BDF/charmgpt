import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Message } from '../types/chat';
import { Artifact } from '../types/artifacts';

interface ChatState {
  messages: Message[];
  artifacts: Artifact[];
  selectedArtifactId: string | null;
  showArtifactWindow: boolean;
  
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (id: string, content: string) => void;
  addArtifact: (artifact: Omit<Artifact, 'id' | 'timestamp'>) => void;
  updateArtifact: (id: string, content: string) => void;
  selectArtifact: (id: string | null) => void;
  toggleArtifactWindow: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      artifacts: [],
      selectedArtifactId: null,
      showArtifactWindow: false,

      addMessage: (message) => set((state) => ({
        messages: [...state.messages, {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        }],
      })),

      updateMessage: (id, content) => set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === id ? { ...msg, content } : msg
        ),
      })),

      addArtifact: (artifact) => {
        const id = crypto.randomUUID();
        set((state) => ({
          artifacts: [...state.artifacts, {
            ...artifact,
            id,
            timestamp: new Date(),
          }],
          selectedArtifactId: id,
          showArtifactWindow: true,
        }));
        return id;
      },

      updateArtifact: (id, content) => set((state) => ({
        artifacts: state.artifacts.map((art) =>
          art.id === id ? { ...art, content } : art
        ),
      })),

      selectArtifact: (id) => set({ selectedArtifactId: id }),

      toggleArtifactWindow: () => set((state) => ({
        showArtifactWindow: !state.showArtifactWindow,
      })),
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        messages: state.messages,
        artifacts: state.artifacts,
      }),
    }
  )
);
