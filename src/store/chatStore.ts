import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Message } from '../types/chat';
import { Artifact } from '../types/artifacts';
// import { useMCPStore } from './mcpStore';
import { parseXMLResponse } from '../utils/xmlParser';

/**
 * Core message interface extension
 * IMPORTANT: artifactId is used to link messages with their associated artifacts
 * This linking is essential for the artifact reference system
 */
interface MessageWithThinking extends Message {
  thinking?: string;
  artifactId?: string;  // DO NOT REMOVE: Required for artifact linking
}

interface ChatState {
  messages: MessageWithThinking[];
  artifacts: Artifact[];
  selectedArtifactId: string | null;
  showArtifactWindow: boolean;
  showList: boolean;
  isLoading: boolean;
  error: string | null;
  
  addMessage: (message: Omit<MessageWithThinking, 'id' | 'timestamp'>) => void;
  updateMessage: (id: string, content: string) => void;
  addArtifact: (artifact: Omit<Artifact, 'timestamp'>) => string;
  updateArtifact: (id: string, content: string) => void;
  deleteArtifact: (id: string) => void;
  clearArtifacts: () => void;
  selectArtifact: (id: string | null) => void;
  toggleArtifactWindow: () => void;
  setShowList: (show: boolean) => void;
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
      showList: false,
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
        // Use the existing ID from the XML
        console.log(`ChatStore: Adding artifact ${artifact.id} at position ${artifact.position}`);
        set((state) => ({
          artifacts: [...state.artifacts, {
            ...artifact,
            timestamp: new Date(),
          }].sort((a, b) => a.position - b.position),
          selectedArtifactId: artifact.id,
          showArtifactWindow: true,
        }));
        return artifact.id;
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
        set({ 
          selectedArtifactId: id,
          showArtifactWindow: true 
        });
      },

      toggleArtifactWindow: () => {
        console.log('ChatStore: Toggling artifact window visibility');
        set((state) => ({
          showArtifactWindow: !state.showArtifactWindow,
        }));
      },

      setShowList: (show: boolean) => {
        console.log('ChatStore: Setting artifact list visibility:', show);
        set({ showList: show });
      },

      /**
       * CRITICAL: Server Communication Function
       * This function handles:
       * 1. Sending messages to the AI server
       * 2. Processing the XML response
       * 3. Creating artifacts and linking them to messages
       * 
       * DO NOT REMOVE the server communication logic unless explicitly replacing it
       * with an alternative communication method
       */
      processMessage: async (content: string) => {
        try {
          set({ isLoading: true, error: null });

          // REQUIRED: Server communication
          // This section must be preserved to maintain AI interaction
          console.log('ChatStore: Sending request to server...');
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
          
          console.log('\n=== Chat Store: Received Server Response ===');
          console.log('Raw response:', {
            length: data.response.length,
            preview: data.response.slice(0, 200) + '...'
          });

          try {
            console.log('ChatStore: Parsing XML response...');
            // XML Response Processing
            // This section handles both artifacts and messages
            // Both parts are required for proper functionality
            const xmlResponse = await parseXMLResponse(data.response);
            console.log('ChatStore: XML parsed successfully:', {
              hasThinking: !!xmlResponse.thinking,
              conversationLength: xmlResponse.conversation.length,
              artifactsCount: xmlResponse.artifacts.length
            });
            
            // Process artifacts first - Required for proper linking
            const artifactIds = xmlResponse.artifacts.map(artifact => {
              console.log('ChatStore: Adding artifact:', {
                type: artifact.type,
                title: artifact.title,
                position: artifact.position
              });
              return get().addArtifact({
                id: artifact.id,  // Include the ID from XML
                artifactId: artifact.artifactId,  // Add the original XML ID
                type: artifact.type,
                title: artifact.title,
                content: artifact.content,
                position: artifact.position,
                language: artifact.language
              });
            });

            // Add assistant message with artifact linking
            // The artifactId link is essential for the reference system
            console.log('ChatStore: Adding assistant message with artifact link:', {
              artifactId: artifactIds[0] || null
            });
            get().addMessage({
              role: 'assistant',
              content: xmlResponse.conversation,
              thinking: xmlResponse.thinking,
              artifactId: artifactIds[0] // DO NOT REMOVE: Links message to first artifact
            });

          } catch (parseError) {
            console.error('ChatStore: XML parsing error:', parseError);
            console.warn('ChatStore: Failed to parse XML response, falling back to plain text');
            get().addMessage({
              role: 'assistant',
              content: data.response
            });
          }
          
          set({ isLoading: false });
        } catch (error) {
          console.error('ChatStore: Error processing message:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            isLoading: false 
          });
          get().addMessage({
            role: 'assistant',
            content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
          });
        }
      },

      clearChat: () => set(_state => ({
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
