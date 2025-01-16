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
        const codeBlockRegex = /```([\w-]*)\n([\s\S]*?)```/g;
        let match;
        const newArtifacts: string[] = [];
        
        if (message.role === 'assistant') {
          while ((match = codeBlockRegex.exec(message.content)) !== null) {
            const [_, language, content] = match;
            console.log(`ChatStore: Processing code block with language: ${language}`);
            
            // Determine the artifact type based on the language/content
            let type: 'code' | 'html' | 'image/svg+xml' | 'text' | 'application/vnd.ant.mermaid' = 'code';
            let title = 'Code Block';
            
            if (language === 'html') {
              type = 'html';
              title = 'HTML Content';
            } else if (language === 'svg' || (language === 'xml' && content.includes('<svg'))) {
              type = 'image/svg+xml';
              title = 'SVG Image';
            } else if (language === 'mermaid') {
              type = 'application/vnd.ant.mermaid';
              title = 'Mermaid Diagram';
            }
            
            const artifactId = get().addArtifact({
              type,
              title,
              content: content.trim(),
              messageId: crypto.randomUUID(),
              language: language || undefined
            });
            
            console.log(`ChatStore: Created ${type} artifact ${artifactId}`);
            newArtifacts.push(artifactId);
          }
        }

        return {
          messages: [...state.messages, {
            ...message,
            id: crypto.randomUUID(),
            timestamp: new Date(),
            artifactId: newArtifacts.length > 0 ? newArtifacts[0] : undefined
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
