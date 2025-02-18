import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Message } from '../types/chat';
import { Artifact, ArtifactType } from '../types/artifacts';
import { useMCPStore } from './mcpStore';

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
  streamingMessageId: string | null;
  streamingContent: string;
  streamingComplete: boolean;
  streamingEnabled: boolean;  // New state variable
  
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
  startStreaming: (messageId: string) => void;
  updateStreamingContent: (content: string) => void;
  completeStreaming: () => void;
  toggleStreaming: () => void;  // New function to toggle streaming
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
      streamingMessageId: null,
      streamingContent: '',
      streamingComplete: true,
      streamingEnabled: true,

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
        
        const newMessage = {
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        };

        return {
          messages: [...state.messages, newMessage],
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
          selectedArtifactId: null,
          showArtifactWindow: false
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
       * 2. Processing the JSON response
       * 3. Creating artifacts and linking them to messages
       * 
       * DO NOT REMOVE the server communication logic unless explicitly replacing it
       * with an alternative communication method
       */
      processMessage: async (content: string) => {
        try {
          set({ 
            isLoading: true, 
            error: null,
            streamingContent: '',
            streamingComplete: false
          });
          
          const messageId = crypto.randomUUID();
          
          const newMessage: MessageWithThinking = {
            role: 'assistant',
            content: '',
            id: messageId,
            timestamp: new Date()
          };
          
          set(state => ({
            messages: [...state.messages, newMessage],
            streamingMessageId: messageId,
            streamingContent: ''
          }));

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
                })),
              blockedServers: useMCPStore.getState().getBlockedServers()
            })
          });

          if (!response.ok) {
            throw new Error('Failed to get response from chat API');
          }

          const data = await response.json();
          const storeResponse = data.response;
          
          // Get the full content
          const fullContent = storeResponse.conversation;
          
          if (get().streamingEnabled) {
            // Stream the content in chunks
            const chunkSize = 20;
            let currentPosition = 0;
            let buffer = '';
            let accumulatedContent = '';
            
            const processChunk = (chunk: string): string => {
              const combined = buffer + chunk;
              let safeText = combined;
              let newBuffer = '';

              const lastOpenIndex = combined.lastIndexOf('<');
              if (lastOpenIndex !== -1) {
                const closeIndex = combined.indexOf('>', lastOpenIndex);
                if (closeIndex === -1) {
                  safeText = combined.slice(0, lastOpenIndex);
                  newBuffer = combined.slice(lastOpenIndex);
                }
              }

              const backtickCount = (safeText.match(/`/g) || []).length;
              if (backtickCount % 2 !== 0) {
                const lastBacktickIndex = safeText.lastIndexOf('`');
                newBuffer = safeText.slice(lastBacktickIndex) + newBuffer;
                safeText = safeText.slice(0, lastBacktickIndex);
              }

              buffer = newBuffer;
              return safeText;
            };
            
            while (currentPosition < fullContent.length) {
              const nextPosition = Math.min(currentPosition + chunkSize, fullContent.length);
              const chunk = fullContent.slice(currentPosition, nextPosition);
              
              const safeChunk = processChunk(chunk);
              if (safeChunk) {
                accumulatedContent += safeChunk;
                
                set(state => ({
                  messages: state.messages.map(msg =>
                    msg.id === messageId ? { ...msg, content: accumulatedContent } : msg
                  ),
                  streamingContent: accumulatedContent
                }));
              }
              
              currentPosition = nextPosition;
              await new Promise(resolve => setTimeout(resolve, .5));
            }
            
            if (buffer) {
              accumulatedContent += buffer;
              set(state => ({
                messages: state.messages.map(msg =>
                  msg.id === messageId ? { ...msg, content: accumulatedContent } : msg
                ),
                streamingContent: accumulatedContent
              }));
            }
          } else {
            set(state => ({
              messages: state.messages.map(msg =>
                msg.id === messageId ? { ...msg, content: fullContent } : msg
              ),
              streamingContent: fullContent,
              streamingComplete: true
            }));
          }

          // Process artifacts
          const artifactIds = storeResponse.artifacts?.map((artifact: {
            id: string;
            artifactId: string;
            type: ArtifactType;
            title: string;
            content: string;
            position: number;
            language?: string;
          }) => {
            return get().addArtifact({
              id: artifact.id,
              artifactId: artifact.artifactId,
              type: artifact.type,
              title: artifact.title,
              content: artifact.content,
              position: artifact.position,
              language: artifact.language
            });
          }) || [];

          // Update final message state
          set(state => ({
            messages: state.messages.map(msg =>
              msg.id === messageId ? {
                ...msg,
                content: fullContent,
                thinking: storeResponse.thinking,
                artifactId: artifactIds[0]
              } : msg
            ),
            streamingMessageId: null,
            streamingComplete: true
          }));

          set({ isLoading: false });
          
        } catch (error) {
          console.error('ChatStore: Error processing message:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Unknown error',
            isLoading: false,
            streamingMessageId: null,
            streamingContent: '',
            streamingComplete: true
          });
        }
      },

      clearChat: () => set(_state => ({
        messages: [],
        selectedArtifactId: null,
        artifacts: [],
        isLoading: false,
        error: null,
        showArtifactWindow: false
      })),

      startStreaming: (messageId: string) => {
        set({ 
          streamingMessageId: messageId,
          streamingContent: '',
          streamingComplete: false
        });
      },

      updateStreamingContent: (content: string) => {
        set({ streamingContent: content });
      },

      completeStreaming: () => {
        set({ 
          streamingMessageId: null,
          streamingComplete: true
        });
      },

      toggleStreaming: () => {
        set((state) => ({
          streamingEnabled: !state.streamingEnabled
        }));
      }
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        messages: state.messages,
        artifacts: state.artifacts,
      })
    }
  )
);
