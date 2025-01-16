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
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      artifacts: [],
      selectedArtifactId: null,
      showArtifactWindow: false,

      clearMessages: () => {
        console.log('ChatStore: Clearing all messages and artifacts');
        set({ messages: [] });
      },

      addMessage: (message) => set((state) => {
        if (!message.content || message.content.trim() === '') {
          console.warn('ChatStore: Attempted to add empty message, ignoring');
          return state;
        }
        
        // Check if message contains code blocks that should create artifacts
        const codeBlockRegex = /```[\s\S]*?```/g;
        const codeBlocks = message.content.match(codeBlockRegex);
        
        if (codeBlocks && message.role === 'assistant') {
          console.log(`ChatStore: Found ${codeBlocks.length} code blocks in assistant message`);
          codeBlocks.forEach((block, index) => {
            const language = block.split('\n')[0].replace('```', '').trim();
            const content = block.replace(/```[\s\S]*?\n/, '').replace(/```$/, '');
            
            const artifactId = get().addArtifact({
              type: 'code',
              title: `Code Block ${index + 1}`,
              content: content,
              messageId: crypto.randomUUID(),
              language
            });
            
            console.log(`ChatStore: Created artifact ${artifactId} for code block ${index + 1}`);
          });
        }

        return {
          messages: [...state.messages, {
            ...message,
            id: crypto.randomUUID(),
            timestamp: new Date(),
          }],
        };
      }),

      updateMessage: (id, content) => {
        console.log(`ChatStore: Updating message ${id}`);
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, content } : msg
          ),
        }));
      },

      addArtifact: (artifact) => {
        const id = crypto.randomUUID();
        console.log(`ChatStore: Adding new artifact ${id} of type ${artifact.type}`);
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

      updateArtifact: (id, content) => {
        console.log(`ChatStore: Updating artifact ${id}`);
        set((state) => ({
          artifacts: state.artifacts.map((art) =>
            art.id === id ? { ...art, content } : art
          ),
        }));
      },

      selectArtifact: (id) => {
        console.log(`ChatStore: Selecting artifact ${id}`);
        set({ selectedArtifactId: id });
      },

      toggleArtifactWindow: () => {
        console.log('ChatStore: Toggling artifact window visibility');
        set((state) => ({
          showArtifactWindow: !state.showArtifactWindow,
        }));
      },

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
              history: get().messages
                .filter(msg => msg.content.trim() !== '')
                .map(msg => ({
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
