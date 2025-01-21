import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Message } from '../types/chat';
import { Artifact } from '../types/artifacts';
import { useMCPStore } from './mcpStore';
import { parseXMLResponse, extractReferences, cleanConversationContent } from '../utils/xmlParser';

interface MessageWithThinking extends Message {
  thinking?: string;
}

interface ChatState {
  messages: Message[];
  artifacts: Artifact[];
  selectedArtifactId: string | null;
  showArtifactWindow: boolean;
  isLoading: boolean;
  error: string | null;
  
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (id: string, content: string) => void;
  addArtifact: (artifact: Omit<Artifact, 'id' | 'timestamp'>) => string;
  updateArtifact: (id: string, content: string) => void;
  deleteArtifact: (id: string) => void;
  clearArtifacts: () => void;
  selectArtifact: (id: string | null) => void;
  toggleArtifactWindow: () => void;
  processMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      artifacts: [],
      selectedArtifactId: null,
      showArtifactWindow: false,
      isLoading: false,
      error: null,

      clearMessages: () => {
        console.log('ChatStore: Clearing all messages and artifacts');
        set({ 
          messages: [],
          artifacts: [],
          selectedArtifactId: null
        });
      },

      addMessage: (message) => set((state) => {
        if (!message.content || message.content.trim() === '') {
          console.warn('ChatStore: Attempted to add empty message, ignoring');
          return state;
        }
        
        // We no longer need to convert code blocks to artifacts
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

      deleteArtifact: (id: string) => {
        console.log(`ChatStore: Deleting artifact ${id}`);
        set((state) => {
          const newArtifacts = state.artifacts.filter(a => a.id !== id);
          return {
            artifacts: newArtifacts,
            selectedArtifactId: state.selectedArtifactId === id ? 
              (newArtifacts[0]?.id || null) : state.selectedArtifactId
          };
        });
      },

      clearArtifacts: () => {
        console.log('ChatStore: Clearing all artifacts');
        set({ 
          artifacts: [],
          selectedArtifactId: null
        });
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

        try {
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
          
          console.log('\n=== Chat Store: Server Response ===');
          console.log('Raw response:', {
            length: data.response.length,
            preview: data.response.slice(0, 200) + '...'
          });

          try {
            // Try to parse as XML response
            const xmlResponse = parseXMLResponse(data.response);
            
            // Process artifacts first
            const artifactIds = xmlResponse.artifacts.map(artifact => {
              return get().addArtifact({
                type: artifact.type,
                title: artifact.title,
                content: artifact.content,
                messageId: crypto.randomUUID()
              });
            });

            // Extract references from conversation (for tracking purposes)
            const refs = extractReferences(xmlResponse.conversation);
            
            // Add assistant message with first artifact (if any)
            get().addMessage({
              role: 'assistant',
              content: xmlResponse.conversation,
              thinking: xmlResponse.thinking,
              artifactId: artifactIds[0] // Link to first artifact if any
            } as MessageWithThinking);

          } catch (parseError) {
            console.warn('ChatStore: Failed to parse XML response, falling back to plain text', parseError);
            get().addMessage({
              role: 'assistant',
              content: data.response
            });
          }

        } catch (error) {
          console.error('ChatStore: Error processing message:', error);
          get().addMessage({
            role: 'assistant',
            content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
          });
        }
      },

      clearChat: () => set(state => ({
        messages: [],
        selectedArtifactId: null,
        artifacts: [],
        isLoading: false,
        error: null
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
