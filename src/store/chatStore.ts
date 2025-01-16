import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Message } from '../types/chat';
import { Artifact } from '../types/artifacts';
import { useMCPStore } from './mcpStore';

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
  processMessage: (content: string) => Promise<void>;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
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

      processMessage: async (content) => {
        const mcpStore = useMCPStore.getState();
        const activeServer = mcpStore.activeServer;
        
        console.log('ChatStore: Processing message, active server:', activeServer);
        
        // Add user message
        get().addMessage({
          role: 'user',
          content
        });

        try {
          // Always use the server for message processing
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: content,
              history: get().messages.map(msg => ({
                role: msg.role,
                content: msg.content
              }))
            })
          });

          if (!response.ok) {
            throw new Error('Failed to get response from chat API');
          }

          const data = await response.json();
          
          // Add assistant response
          get().addMessage({
            role: 'assistant',
            content: data.response
          });

        } catch (error) {
          console.error('ChatStore: Error processing message:', error);
          get().addMessage({
            role: 'assistant',
            content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
          });
        }
      }
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
