/**
 * ChatStore: Manages the chat state and interactions
 * 
 * This store is responsible for:
 * 1. Managing messages and conversations
 * 2. Handling user and assistant messages
 * 3. Processing artifacts and linking them to messages
 * 4. Managing the streaming state for real-time updates
 * 
 * DO NOT REMOVE the artifact linking logic as it is essential
 * for the proper functioning of the application.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Message, MessageWithThinking, ConversationMetadata, Conversation, ConversationState, StatusUpdate } from '../types/chat';
import { Artifact, ArtifactType } from '../types/artifacts';
import { API_ENDPOINTS, getApiUrl } from '../utils/api';
import { useModelStore } from './modelStore';
import { useMCPStore } from './mcpStore';
import { KnowledgeGraphNode, KnowledgeGraphLink, KnowledgeGraphData } from '../types/knowledgeGraph';
import { useProjectStore } from './projectStore';

/**
 * Core message interface extension
 * IMPORTANT: artifactId is used to link messages with their associated artifacts
 * This linking is essential for the artifact reference system
 */
// MessageWithThinking is now imported from '../types/chat'

export interface ChatState extends ConversationState {
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
  streamingEnabled: boolean;
  pinnedArtifactIds: string[]; // Changed from pinnedGraphId to support multiple artifacts
  chatInput: string; // New state for chat input
  inProjectConversationFlow: boolean; // Flag to track if we're continuing a project conversation
  activeCompletionId?: string | null; // Optional ID of the active completion
  blockedServers?: string[]; // Optional list of blocked servers
  
  // Existing message functions
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
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
  toggleStreaming: () => void;
  // Updated pinning functions
  pinArtifact: (id: string) => void;
  unpinArtifact: (id: string) => void;
  toggleArtifactPin: (id: string) => void;
  isPinnedArtifact: (id: string) => boolean;
  getPinnedArtifacts: () => Artifact[];
  clearPinnedArtifacts: () => void;
  // Legacy function for backward compatibility with knowledge graph components
  setPinnedGraphId: (id: string | null) => void;
  pinnedGraphId: string | null; // Computed property for backward compatibility
  updateChatInput: (text: string, append: boolean) => void; // New function to update chat input
  setProjectConversationFlow: (enabled: boolean) => void; // Function to set project conversation flow state
  
  // New conversation management functions
  startNewConversation: (name?: string) => string;
  switchConversation: (id: string) => void;
  renameConversation: (id: string, name: string) => void;
  deleteConversation: (id: string) => void;
  migrateExistingMessages: () => void;
  
  // New graph versioning functions
  updateGraphArtifact: (baseArtifactId: string, updates: {
    nodes?: KnowledgeGraphNode[] | ((nodes: KnowledgeGraphNode[]) => KnowledgeGraphNode[]);
    links?: KnowledgeGraphLink[] | ((links: KnowledgeGraphLink[]) => KnowledgeGraphLink[]);
    commandDescription?: string;
    commandParams?: Record<string, any>;
    versionLabel?: string;
  }) => string | null;
  getGraphVersionHistory: (artifactId: string) => Artifact[];
  getLatestGraphVersion: (artifactId: string) => Artifact | null;
  
  // Status updates
  toggleStatusUpdatesCollapsed: (messageId: string) => void;

  // New selector for unassociated conversations
  getUnassociatedConversations: () => string[];
  
  // New function for bidirectional project-conversation relationship
  setConversationProject: (conversationId: string, projectId: string | undefined) => void;
  
  // Add new migration function
  migrateConversationsToProjects: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => {
      // Run migration immediately
      setTimeout(() => {
        const state = get();
        if (state.messages.length > 0 && Object.keys(state.conversations).length === 0) {
          console.log('ChatStore: Migrating existing messages to conversation');
          get().migrateExistingMessages();
        }
      }, 0);

      return {
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
        streamingEnabled: false,
        pinnedArtifactIds: [], // Initialize pinned artifacts
        chatInput: '', // Initialize chat input
        inProjectConversationFlow: false, // Initialize the project conversation flow flag
        activeCompletionId: null, // Initialize the active completion ID
        blockedServers: [], // Initialize the blocked servers
        
        // New conversation state
        currentConversationId: null,
        conversations: {},
        
        // Add new function to set conversation's project
        setConversationProject: (conversationId: string, projectId: string | undefined) => {
          console.log(`ChatStore: Setting project ${projectId} for conversation ${conversationId}`);
          set(state => {
            // Validate conversation exists
            if (!state.conversations[conversationId]) {
              console.error(`Cannot set project for non-existent conversation: ${conversationId}`);
              return state;
            }
            
            // Create an explicit partial state update
            const updatedState: Partial<ChatState> = {
              conversations: {
                ...state.conversations,
                [conversationId]: {
                  ...state.conversations[conversationId],
                  metadata: {
                    ...state.conversations[conversationId].metadata,
                    projectId,
                    lastUpdated: new Date()
                  }
                }
              }
            };
            
            return updatedState;
          });
        },

        // Add new migration function to update conversations with project references
        migrateConversationsToProjects: () => {
          // console.log('ChatStore: Migrating conversation-project associations');
          const projects = useProjectStore.getState().projects;
          const chatStore = get();
          
          // Build a mapping of conversationId -> projectId
          const conversationProjectMap: Record<string, string> = {};
          
          // Go through each project and record its conversations
          projects.forEach(project => {
            project.conversations.forEach(conv => {
              conversationProjectMap[conv.id] = project.id;
            });
          });
          
          // Update all conversations with their project IDs
          const updatedConversations = {...chatStore.conversations};
          
          Object.keys(updatedConversations).forEach(convId => {
            if (conversationProjectMap[convId]) {
              updatedConversations[convId] = {
                ...updatedConversations[convId],
                metadata: {
                  ...updatedConversations[convId].metadata,
                  projectId: conversationProjectMap[convId]
                }
              };
            }
          });
          
          // Set the updated conversations
          set({
            conversations: updatedConversations
          });
          
          console.log('ChatStore: Migrated conversation-project associations');
        },

        // Add new selector for unassociated conversations
        getUnassociatedConversations: () => {
          const state = get();
          const allConversationIds = Object.keys(state.conversations);
          const projectStore = useProjectStore.getState();
          
          // Get all conversation IDs that are associated with any project
          const projectAssociatedIds = new Set(
            projectStore.projects.flatMap(project => 
              project.conversations.map(conv => conv.id)
            )
          );
          
          // Return conversation IDs that are not in any project
          return allConversationIds.filter(id => !projectAssociatedIds.has(id));
        },

        // Add new function to update chat input
        updateChatInput: (text: string, append: boolean = false) => {
          console.log('ChatStore: Updating chat input with:', text, append ? '(append)' : '(replace)');
          set((state) => {
            // Only update if the value is actually changing
            const newInput = append 
              ? (state.chatInput.trim() ? `${state.chatInput.trim()} ${text}` : text)
              : text;
              
            // Return new state only if input has changed
            if (newInput !== state.chatInput) {
              return { chatInput: newInput };
            }
            
            // Return empty object if no change to prevent unnecessary updates
            return {};
          });
        },

        clearMessages: () => {
          // console.log('ChatStore: Clearing all messages and artifacts');
          set({ 
            messages: [],
            artifacts: [],
            selectedArtifactId: null
          });
        },

        addMessage: (message) => set((state) => {
          // console.log('[STATE UPDATE: addMessage] Starting:', {
          //   hasCurrentConversation: !!state.currentConversationId,
          //   currentMessages: state.messages.length,
          //   messageContent: message.content?.substring(0, 50) + '...'
          // });

          if (!message.content || message.content.trim() === '') {
            console.warn('ChatStore: Attempted to add empty message, ignoring');
            return state;
          }
          
          // If no current conversation, create one first
          if (!state.currentConversationId) {
            // console.log('[STATE UPDATE: conversation] Creating new conversation');
            const conversationId = get().startNewConversation();
            state = get(); // Get fresh state after conversation creation
            // console.log('[STATE UPDATE: conversation] Created:', {
            //   conversationId,
            //   currentConversationId: state.currentConversationId,
            //   conversationCount: Object.keys(state.conversations).length
            // });
          }

          const newMessage = {
            ...message,
            id: crypto.randomUUID(),
            timestamp: new Date(),
          };

          // console.log('[STATE UPDATE: message] Created:', {
          //   messageId: newMessage.id,
          //   role: newMessage.role,
          //   contentPreview: newMessage.content?.substring(0, 50) + '...'
          // });

          // Update conversation first
          const updatedConversation = {
            ...state.conversations[state.currentConversationId!],
            messages: [...state.conversations[state.currentConversationId!].messages, newMessage],
            metadata: {
              ...state.conversations[state.currentConversationId!].metadata,
              lastUpdated: new Date(),
              messageCount: state.conversations[state.currentConversationId!].metadata.messageCount + 1
            }
          };

          // console.log('[STATE UPDATE: conversation] Updated:', {
          //   conversationId: state.currentConversationId,
          //   messageCount: updatedConversation.messages.length,
          //   metadata: {
          //     lastUpdated: updatedConversation.metadata.lastUpdated,
          //     messageCount: updatedConversation.metadata.messageCount,
          //     projectId: updatedConversation.metadata.projectId
          //   }
          // });

          // Return complete state update, deriving messages from conversation
          const newState = {
            messages: updatedConversation.messages, // Derive from conversation
            conversations: {
              ...state.conversations,
              [state.currentConversationId!]: updatedConversation
            }
          };

          // console.log('[STATE UPDATE: final] State updated:', {
          //   messagesLength: newState.messages.length,
          //   conversationsCount: Object.keys(newState.conversations).length,
          //   currentConversationMessages: newState.conversations[state.currentConversationId!].messages.length
          // });

          return newState;
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
          // console.log(`ChatStore: Adding artifact ${artifact.id} at position ${artifact.position}`);
          set((state) => {
            const newArtifact = {
              ...artifact,
              timestamp: new Date(),
            };

            // Update both global artifacts and conversation artifacts
            const updatedConversation = state.currentConversationId ? {
              ...state.conversations[state.currentConversationId],
              artifacts: [...state.conversations[state.currentConversationId].artifacts, newArtifact]
                .sort((a, b) => a.position - b.position)
            } : null;

            const updates: Partial<ChatState> = {
              artifacts: [...state.artifacts, newArtifact].sort((a, b) => a.position - b.position),
              selectedArtifactId: artifact.id,
              showArtifactWindow: true
            };

            if (updatedConversation && state.currentConversationId) {
              updates.conversations = {
                ...state.conversations,
                [state.currentConversationId]: updatedConversation
              };
            }

            return updates;
          });
          return artifact.id;
        },

        updateArtifact: (id, content) => {
          // console.log(`ChatStore: Updating artifact ${id}`);
          set((state) => ({
            artifacts: state.artifacts.map((art) =>
              art.id === id ? { ...art, content } : art
            ),
          }));
        },

        deleteArtifact: (id: string) => {
          // console.log(`ChatStore: Deleting artifact ${id}`);
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
          // console.log('ChatStore: Clearing all artifacts');
          set({ 
            artifacts: [],
            selectedArtifactId: null,
            showArtifactWindow: false
          });
        },

        selectArtifact: (id) => {
          // console.log(`ChatStore: Selecting artifact ${id}`);
          set({ 
            selectedArtifactId: id,
            showArtifactWindow: true 
          });
        },

        toggleArtifactWindow: () => {
          // console.log('ChatStore: Toggling artifact window visibility');
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
          const { conversations, currentConversationId, activeCompletionId } = get();
          console.log('[DEBUG] Starting processMessage');
          
          if (activeCompletionId) {
            console.warn('ChatStore: Cannot process a new message while a completion is already in progress');
            return;
          }
          
          // Set loading state to true at the start
          console.log('[DEBUG] Before setting isLoading to true:', get().isLoading);
          set({ isLoading: true });
          console.log('[DEBUG] After setting isLoading to true:', get().isLoading);
          
          // Get the selected model from the model store
          const selectedModel = useModelStore.getState().selectedModel;
          
          const currentConversation = conversations[currentConversationId as string];
          if (!currentConversation) {
            console.error('ChatStore: No current conversation found');
            return;
          }
          
          // Create a new assistant message immediately to store status updates
          const assistantMessageId = crypto.randomUUID();
          const assistantMessage = {
            id: assistantMessageId,
            role: 'assistant' as const,
            content: '_Processing your request..._',
            statusUpdates: [{
              id: crypto.randomUUID(),
              message: 'Processing request...',
              timestamp: new Date()
            }],
            statusUpdatesCollapsed: false,
            timestamp: new Date()
          };

          // console.log('[STATE UPDATE 1] Creating initial assistant message:', {
          //   id: assistantMessageId,
          //   content: assistantMessage.content,
          //   statusUpdatesCount: assistantMessage.statusUpdates.length
          // });

          // Add the assistant message to the conversation immediately
          set(state => {
            // console.log('[STATE UPDATE 2] Adding assistant message to state:', {
            //   messageId: assistantMessageId,
            //   existingMessagesCount: state.messages.length,
            //   currentConversationId: state.currentConversationId
            // });

            // Preserve existing messages exactly as they are
            const existingMessages = state.conversations[state.currentConversationId!].messages.map(msg => ({
              ...msg,
              statusUpdates: msg.statusUpdates ? [...msg.statusUpdates] : undefined,
              artifactIds: msg.artifactIds ? [...msg.artifactIds] : undefined
            }));
            
            const updatedConversation = {
              ...state.conversations[state.currentConversationId!],
              messages: [...existingMessages, assistantMessage],
              metadata: {
                ...state.conversations[state.currentConversationId!].metadata,
                lastUpdated: new Date(),
                messageCount: state.conversations[state.currentConversationId!].metadata.messageCount + 1
              }
            };

            return {
              messages: updatedConversation.messages,
              conversations: {
                ...state.conversations,
                [state.currentConversationId!]: updatedConversation
              },
              streamingMessageId: assistantMessageId
            };
          });
          
          // Block the graph name list from being sent to the MCP server
          const mcpStore = useMCPStore.getState();
          const blockedServers = mcpStore.getBlockedServers();
          
          // console.log('\n=== BLOCKED SERVERS DEBUG ===');
          // console.log('Blocked servers from MCPStore:', blockedServers);
          
          // Always fetch the exact server names directly from the API before making the request
          let exactServerNames: string[] = [];
          try {
            const serverNamesResponse = await fetch('/api/server-names');
            if (serverNamesResponse.ok) {
              const { serverNames } = await serverNamesResponse.json();
              exactServerNames = serverNames || [];
              // console.log('Exact server names from API:', exactServerNames);
            }
          } catch (error) {
            console.error('Error fetching exact server names:', error);
          }
          
          // Match the blocked server names against the exact server names
          // ONLY send blocked servers that exactly match a server name
          const sanitizedBlockedServers = blockedServers.filter(
            blockedName => exactServerNames.includes(blockedName)
          );
          
          // console.log('Final sanitized blocked servers sent to API:', sanitizedBlockedServers);
          // console.log('=== END BLOCKED SERVERS DEBUG ===\n');
          
          // Get pinned graph if available
          const pinnedArtifactIds = get().pinnedArtifactIds;
          let pinnedArtifacts: Artifact[] = [];
          
          if (pinnedArtifactIds.length > 0) {
            pinnedArtifacts = get().artifacts.filter(a => pinnedArtifactIds.includes(a.id));
            if (pinnedArtifacts.length > 0) {
              console.log('ChatStore: Including pinned artifacts in message:', pinnedArtifactIds);
            }
          }

          // Get all messages for the history - Create a stripped version ONLY for the API
          const messageHistory = currentConversation.messages
            .filter(msg => msg.content.trim() !== '')
            .map(msg => ({
              role: msg.role,
              content: msg.content
            }));

          // Choose the appropriate API endpoint based on the model
          // Use CHAT_ARTIFACTS for all providers as it's the most feature-complete endpoint
          const endpoint = API_ENDPOINTS.CHAT_ARTIFACTS;
          const apiUrl = getApiUrl(endpoint);

          // Check stringified request body
          const requestBody = JSON.stringify({
            message: content,
            history: messageHistory,
            blockedServers: sanitizedBlockedServers,
            pinnedArtifacts: pinnedArtifacts,
            modelProvider: selectedModel
          });

          // console.log('Full request body stringified:', requestBody);
          // console.log('Parsing request body back:', JSON.parse(requestBody).blockedServers);
          // console.log('=== END DEBUG ===\n');

          try {
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: requestBody
            });

            if (!response.ok) {
              console.log('[STATE UPDATE] Setting isLoading to false due to !response.ok');
              set({ isLoading: false });
              throw new Error('Failed to get response from chat API');
            }

            // Process the streaming response
            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finalResponse = null;

            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                console.log('[STATE UPDATE] Stream reader done');
                console.log('[STATE UPDATE] Resetting isLoading to false');
                set({ isLoading: false });
                console.log('[STATE UPDATE] Current isLoading state:', get().isLoading);
                break;
              }
              
              // Decode the chunk and add to buffer
              const newText = decoder.decode(value, { stream: true });
              console.log('[STREAM DEBUG] Raw chunk received:', newText);
              buffer += newText;
              
              // Process complete JSON objects
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep the last potentially incomplete line in the buffer
              
              console.log('[STREAM DEBUG] Processing lines:', lines.length);
              console.log('[STREAM DEBUG] Remaining buffer:', buffer);
              
              for (const line of lines) {
                if (!line.trim()) continue;
                
                try {
                  console.log('[STREAM DEBUG] Processing line:', line);
                  const data = JSON.parse(line);
                  console.log(`[STREAM DEBUG] Received chunk type:`, data.type);
                  
                  if (data.type === 'status') {
                    // console.log('[STATE UPDATE 3 - Status] Processing status update:', {
                    //   messageId: assistantMessageId,
                    //   statusMessage: data.message,
                    //   timestamp: new Date().toISOString()
                    // });
                    
                    set((state: ChatState) => {
                      const currentMessage = state.conversations[state.currentConversationId!].messages.find(msg => msg.id === assistantMessageId);
                      // console.log('[STATE UPDATE 3 - Status] Current message state:', {
                      //   found: !!currentMessage,
                      //   currentContent: currentMessage?.content,
                      //   currentStatusCount: currentMessage?.statusUpdates?.length || 0
                      // });

                      // Update conversation first
                      const updatedConversation = {
                        ...state.conversations[state.currentConversationId!],
                        messages: state.conversations[state.currentConversationId!].messages.map(msg => {
                          if (msg.id === assistantMessageId) {
                            // Only update content if we're still in the initial status stage
                            // (no real content has been received yet)
                            const contentUpdate = msg.content === '_Processing your request..._' ?
                              `_Status: ${data.message}_\n\n` : 
                              msg.content;
                              
                            return {
                              ...msg,
                              content: contentUpdate,
                              statusUpdates: [
                                ...((msg.statusUpdates || []) as StatusUpdate[]),
                                {
                                  id: crypto.randomUUID(),
                                  message: data.message,
                                  timestamp: new Date()
                                }
                              ]
                            };
                          }
                          return msg;
                        })
                      };

                      return {
                        messages: updatedConversation.messages,
                        conversations: {
                          ...state.conversations,
                          [state.currentConversationId!]: updatedConversation
                        },
                        streamingContent: `_Status: ${data.message}_\n\n`
                      };
                    });
                  } 
                  else if (data.type === 'content') {
                    // console.log('[STATE UPDATE 4 - Content] Received content chunk:', {
                    //   messageId: assistantMessageId,
                    //   contentPreview: data.content?.substring(0, 100),
                    //   contentLength: data.content?.length || 0
                    // });
                    
                    set((state: ChatState) => {
                      // const currentMessage = state.conversations[state.currentConversationId!].messages.find(msg => msg.id === assistantMessageId);
                      // console.log('[STATE UPDATE 4 - Content] Current message state before update:', {
                      //   found: !!currentMessage,
                      //   currentContent: currentMessage?.content?.substring(0, 100),
                      //   currentStatusCount: currentMessage?.statusUpdates?.length || 0
                      // });
                      
                      // console.log('[STATE UPDATE 4 - Content] About to update state with content');
                      
                      // Update conversation first
                      const updatedConversation = {
                        ...state.conversations[state.currentConversationId!],
                        messages: state.conversations[state.currentConversationId!].messages.map(msg => {
                          if (msg.id === assistantMessageId) {
                            // Get current content
                            const currentContent = msg.content || '';
                            // Only accumulate content if it's not a status message
                            const contentToUse = currentContent.startsWith('_Status:') ? 
                              data.content : 
                              currentContent + data.content;
                            
                            console.log('[CONTENT ACCUMULATION] Adding new content chunk, total length:', contentToUse.length);
                            
                            return {
                              ...msg,
                              content: contentToUse,
                              statusUpdates: msg.statusUpdates || [] // Preserve existing status updates
                            };
                          }
                          return msg;
                        })
                      };

                      return {
                        messages: updatedConversation.messages, // Derive from conversation
                        conversations: {
                          ...state.conversations,
                          [state.currentConversationId!]: updatedConversation
                        }
                      };
                    });
                  }
                  else if (data.type === 'artifact') {
                    // Process artifact - don't update UI immediately
                    // console.log('[STREAM DEBUG] Received artifact:', data.artifact?.title);
                    // console.log('[STATE UPDATE - Artifact] About to add artifact to state');
                    
                    // Add the artifact to the store immediately
                    if (data.artifact) {
                      const artifactId = get().addArtifact({
                        id: data.artifact.id || crypto.randomUUID(),
                        artifactId: data.artifact.artifactId || crypto.randomUUID(),
                        type: data.artifact.type,
                        title: data.artifact.title,
                        content: data.artifact.content,
                        position: data.artifact.position || 0,
                        language: data.artifact.language
                      });
                      
                      // Associate artifact with the message
                      set((state: ChatState) => {
                        // console.log('[STATE UPDATE - Artifact] About to update message with artifact reference');
                        const updatedMessages = state.messages.map((msg: MessageWithThinking) => {
                          if (msg.id === assistantMessageId) {
                            const existingArtifactIds = msg.artifactIds || [];
                            if (!existingArtifactIds.includes(artifactId)) {
                              // console.log('[STATE UPDATE - Artifact] Adding artifact reference to message');
                              return { 
                                ...msg,
                                artifactId: msg.artifactId || artifactId,
                                artifactIds: [...existingArtifactIds, artifactId]
                              };
                            }
                          }
                          return msg;
                        });
                        
                        // console.log('[STATE UPDATE - Artifact] State update with artifact reference complete');
                        return { messages: updatedMessages };
                      });
                    }
                  }
                  else if (data.type === 'result') {
                    // Store the final response for processing after the loop
                    // console.log('[STREAM DEBUG] Received final result data:', {
                    //   hasResponse: !!data.response,
                    //   responseType: typeof data.response,
                    //   responseKeys: data.response ? Object.keys(data.response) : [],
                    //   conversationType: data.response?.conversation ? typeof data.response.conversation : 'none',
                    //   thinkingPresent: !!data.response?.thinking
                    // });
                    finalResponse = data.response;
                  }
                  else if (data.type === 'error') {
                    throw new Error(data.message);
                  }
                } catch (e) {
                  console.error('Error parsing chunk:', e, 'Line:', line);
                }
              }
            }

            // Process the final response
            if (finalResponse) {
              console.log('[STATE UPDATE] Processing final response');
              const startTime = Date.now();
              
              // CRITICAL: Capture status updates BEFORE artifact processing
              const beforeFinalMsg = get().messages.find(msg => msg.id === assistantMessageId);
              const savedStatusUpdates = beforeFinalMsg?.statusUpdates || [];
              // Save accumulated content too
              const accumulatedContent = beforeFinalMsg?.content || '';
              console.log('[CONTENT ACCUMULATION] Pre-final processing content length:', accumulatedContent.length);
              
              const storeResponse = finalResponse;

              let fullContent = '';
              if (typeof storeResponse.conversation === 'string') {
                // Preserve accumulated content over final content if it exists and is substantial
                // This prevents losing streamed content if the final response is incomplete
                fullContent = (accumulatedContent.length > 50 && 
                              !accumulatedContent.startsWith('_Status') && 
                              !accumulatedContent.startsWith('_Processing')) ? 
                                accumulatedContent : 
                                storeResponse.conversation;
                console.log('[CONTENT PRESERVATION] Using content source:', 
                  (accumulatedContent.length > 50 && 
                   !accumulatedContent.startsWith('_Status') && 
                   !accumulatedContent.startsWith('_Processing')) ? 
                    'accumulated' : 'final response');
              }

              // Update assistant message with thinking
              set(state => {
                const updatedConversation = {
                  ...state.conversations[state.currentConversationId!],
                  messages: state.conversations[state.currentConversationId!].messages.map(msg =>
                    msg.id === assistantMessageId ? { ...msg, thinking: storeResponse.thinking } : msg
                  )
                };

                return {
                  messages: updatedConversation.messages,
                  conversations: {
                    ...state.conversations,
                    [state.currentConversationId!]: updatedConversation
                  }
                };
              });
              
              // Process artifacts and add them to the store
              const artifactIds = storeResponse.artifacts?.map((artifact: {
                id: string;
                artifactId: string;
                type: ArtifactType;
                title: string;
                content: string;
                position: number;
                language?: string;
              }) => {
                console.log('ChatStore: Processing artifact:', {
                  id: artifact.id,
                  artifactId: artifact.artifactId,
                  type: artifact.type,
                  title: artifact.title
                });
                
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
              
              console.log('ChatStore: Processed all artifacts:', {
                count: artifactIds.length,
                ids: artifactIds,
                messageId: assistantMessageId
              });
              
              // Final message update
              set(state => {
                const newState = {
                  messages: state.messages.map(msg => {
                    if (msg.id === assistantMessageId) {
                      return {
                        ...msg,
                        statusUpdates: savedStatusUpdates,
                        content: fullContent,
                        thinking: storeResponse.thinking,
                        artifactId: artifactIds[0],
                        artifactIds: artifactIds.length > 0 ? artifactIds : undefined,
                        statusUpdatesCollapsed: msg.statusUpdatesCollapsed
                      };
                    }
                    return msg;
                  }),
                  conversations: {
                    ...state.conversations,
                    [state.currentConversationId!]: {
                      ...state.conversations[state.currentConversationId!],
                      messages: state.messages.map(msg => ({
                        ...msg,
                        statusUpdates: msg.statusUpdates ? [...msg.statusUpdates] : undefined,
                        artifactIds: msg.artifactIds ? [...msg.artifactIds] : undefined
                      })),
                      metadata: {
                        ...state.conversations[state.currentConversationId!].metadata,
                        lastUpdated: new Date()
                      }
                    }
                  },
                  streamingMessageId: null,
                  streamingContent: fullContent,
                  streamingComplete: true
                };
                return newState;
              });

              // Separate state update specifically for isLoading
              console.log('[DEBUG] Explicitly resetting isLoading state');
              set({ isLoading: false });
              console.log('[DEBUG] isLoading state after explicit reset:', get().isLoading);
            }

          } catch (error) {
            console.error('ChatStore: Error processing message:', error);
            console.log('[DEBUG] Error occurred, isLoading before set:', get().isLoading);
            // Get the current project conversation flow state to preserve it
            const currentInProjectConversationFlow = get().inProjectConversationFlow;
            
            set({ 
              error: error instanceof Error ? error.message : 'Unknown error',
              isLoading: false,
              streamingMessageId: null,
              streamingContent: '',
              streamingComplete: true,
              inProjectConversationFlow: currentInProjectConversationFlow
            });
            console.log('[DEBUG] After error handling, isLoading:', get().isLoading);
            
            // Update the message to show the error
            const errorMessageId = get().streamingMessageId;
            if (errorMessageId) {
              set(state => ({
                messages: state.messages.map(msg =>
                  msg.id === errorMessageId ? 
                    { ...msg, content: `_Error: ${error instanceof Error ? error.message : 'Unknown error'}_` } : 
                    msg
                ),
                inProjectConversationFlow: state.inProjectConversationFlow
              }));
            }
          }
          
          console.log('[DEBUG] Final state at end of processMessage');
          console.log('[DEBUG] Final isLoading state:', get().isLoading);
        },

        clearChat: () => set(_state => ({
          messages: [],
          selectedArtifactId: null,
          artifacts: [],
          isLoading: false,
          error: null,
          showArtifactWindow: false,
          inProjectConversationFlow: false, // Reset the flag when clearing chat
          activeCompletionId: null, // Reset the active completion ID
          blockedServers: [] // Reset the blocked servers
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
        },

        // New conversation management functions
        startNewConversation: (name?: string) => {
          const id = crypto.randomUUID();
          const defaultName = `Conversation ${Object.keys(get().conversations).length + 1}`;
          
          set(state => ({
            conversations: {
              ...state.conversations,
              [id]: {
                metadata: {
                  id,
                  name: name || defaultName,
                  created: new Date(),
                  lastUpdated: new Date(),
                  messageCount: 0
                },
                messages: [],
                artifacts: []
              }
            },
            currentConversationId: id,
            // Clear artifacts and related state when starting new conversation
            artifacts: [],
            selectedArtifactId: null,
            showArtifactWindow: false,
            inProjectConversationFlow: false, // Reset project conversation flow when starting a new conversation
            activeCompletionId: null, // Reset the active completion ID
            blockedServers: [] // Reset the blocked servers
          }));
          
          return id;
        },

        switchConversation: (id: string) => {
          const state = get();
          // console.log('[STATE UPDATE: switch] Starting:', {
          //   fromConversationId: state.currentConversationId,
          //   toConversationId: id,
          //   currentMessagesCount: state.messages.length
          // });

          const conversation = state.conversations[id];
          if (!conversation) {
            // console.warn('[STATE UPDATE: switch] Error: Non-existent conversation:', id);
            return;
          }

          // Preserve project relationship
          const isProjectConversation = !!conversation.metadata.projectId;
          // console.log('[STATE UPDATE: switch] Details:', {
          //   conversationId: id,
          //   messageCount: conversation.messages.length,
          //   isProjectConversation,
          //   projectId: conversation.metadata.projectId
          // });

          set({
            currentConversationId: id,
            messages: conversation.messages,
            artifacts: conversation.artifacts || [],
            selectedArtifactId: null,
            showArtifactWindow: false,
            inProjectConversationFlow: isProjectConversation
          });

          // console.log('[STATE UPDATE: switch] Complete:', {
          //   newCurrentId: id,
          //   messageCount: conversation.messages.length,
          //   hasProject: isProjectConversation
          // });
        },

        renameConversation: (id: string, name: string) => {
          set(state => ({
            conversations: {
              ...state.conversations,
              [id]: {
                ...state.conversations[id],
                metadata: {
                  ...state.conversations[id].metadata,
                  name,
                  lastUpdated: new Date()
                }
              }
            }
          }));
        },

        deleteConversation: (id: string) => {
          set(state => {
            const { [id]: deleted, ...remainingConversations } = state.conversations;
            const newState: Partial<ChatState> = {
              conversations: remainingConversations
            };

            // If deleting current conversation, switch to another one
            if (state.currentConversationId === id) {
              const nextConversationId = Object.keys(remainingConversations)[0];
              if (nextConversationId) {
                newState.currentConversationId = nextConversationId;
                newState.messages = remainingConversations[nextConversationId].messages;
                newState.artifacts = remainingConversations[nextConversationId].artifacts;
              } else {
                newState.currentConversationId = null;
                newState.messages = [];
                newState.artifacts = [];
              }
            }

            return newState;
          });
        },

        migrateExistingMessages: () => {
          const state = get();
          
          // Only migrate if there are messages and no conversations
          if (state.messages.length > 0 && Object.keys(state.conversations).length === 0) {
            const id = crypto.randomUUID();
            
            set(state => ({
              conversations: {
                [id]: {
                  metadata: {
                    id,
                    name: 'Previous Chat History',
                    created: new Date(Math.min(...state.messages.map(m => m.timestamp.getTime()))),
                    lastUpdated: new Date(Math.max(...state.messages.map(m => m.timestamp.getTime()))),
                    messageCount: state.messages.length
                  },
                  messages: state.messages,
                  artifacts: state.artifacts
                }
              },
              currentConversationId: id
            }));
          }
        },

        // New graph versioning functions
        updateGraphArtifact: (baseArtifactId: string, updates: {
          nodes?: KnowledgeGraphNode[] | ((nodes: KnowledgeGraphNode[]) => KnowledgeGraphNode[]);
          links?: KnowledgeGraphLink[] | ((links: KnowledgeGraphLink[]) => KnowledgeGraphLink[]);
          commandDescription?: string;
          commandParams?: Record<string, any>;
          versionLabel?: string;
        }) => {
          const state = get();
          const baseArtifact = state.artifacts.find(a => a.id === baseArtifactId);
          
          if (!baseArtifact || (baseArtifact.type !== 'application/vnd.ant.knowledge-graph' && baseArtifact.type !== 'application/vnd.knowledge-graph')) {
            // console.error('updateGraphArtifact: Base artifact not found or not a knowledge graph');
            return null;
          }
          
          try {
            // Parse current content
            const currentData = JSON.parse(baseArtifact.content) as KnowledgeGraphData;
            
            // Apply updates
            const updatedNodes = typeof updates.nodes === 'function' 
              ? updates.nodes(currentData.nodes)
              : updates.nodes || currentData.nodes;
              
            const updatedLinks = typeof updates.links === 'function'
              ? updates.links(currentData.links)
              : updates.links || currentData.links;
            
            // Create new graph data
            const newData: KnowledgeGraphData = {
              nodes: updatedNodes,
              links: updatedLinks,
              metadata: {
                version: (baseArtifact.versionNumber || 1) + 1,
                previousVersion: baseArtifactId,
                commandHistory: [
                  ...(currentData.metadata?.commandHistory || []),
                  {
                    command: updates.commandDescription || 'Update graph',
                    params: updates.commandParams || {},
                    timestamp: new Date().toISOString()
                  }
                ]
              }
            };
            
            // Create new artifact
            const newArtifactId = crypto.randomUUID();
            const versionNumber = (baseArtifact.versionNumber || 1) + 1;
            
            const newArtifact: Omit<Artifact, 'timestamp'> = {
              id: newArtifactId,
              artifactId: baseArtifact.artifactId, // Keep the same artifactId for linking
              type: baseArtifact.type,
              title: updates.versionLabel 
                ? `${baseArtifact.title.split(' (v')[0]} - ${updates.versionLabel}`
                : `${baseArtifact.title.split(' (v')[0]} (v${versionNumber})`,
              content: JSON.stringify(newData),
              position: baseArtifact.position,
              language: baseArtifact.language,
              previousVersionId: baseArtifactId,
              versionNumber: versionNumber,
              versionLabel: updates.versionLabel,
              versionTimestamp: new Date(),
              graphMetadata: {
                nodeCount: updatedNodes.length,
                edgeCount: updatedLinks.length,
                lastCommand: updates.commandDescription,
                commandParams: updates.commandParams
              }
            };
            
            // Add new artifact and update reference in previous version
            set(state => ({
              artifacts: [
                ...state.artifacts.map(a => 
                  a.id === baseArtifactId ? { ...a, nextVersionId: newArtifactId } : a
                ),
                {...newArtifact, timestamp: new Date()}
              ],
              selectedArtifactId: newArtifactId
            }));
            
            return newArtifactId;
          } catch (error) {
            // console.error('updateGraphArtifact: Failed to update graph:', error);
            return null;
          }
        },
        getGraphVersionHistory: (artifactId: string) => {
          const state = get();
          const artifact = state.artifacts.find(a => a.id === artifactId);
          
          if (!artifact || (artifact.type !== 'application/vnd.ant.knowledge-graph' && artifact.type !== 'application/vnd.knowledge-graph')) {
            return [];
          }
          
          // Find the root version
          let rootArtifact = artifact;
          while (rootArtifact.previousVersionId) {
            const prev = state.artifacts.find(a => a.id === rootArtifact.previousVersionId);
            if (!prev) break;
            rootArtifact = prev;
          }
          
          // Build the version chain
          const history: Artifact[] = [rootArtifact];
          let currentId = rootArtifact.nextVersionId;
          
          while (currentId) {
            const next = state.artifacts.find(a => a.id === currentId);
            if (!next) break;
            history.push(next);
            currentId = next.nextVersionId;
          }
          
          return history;
        },
        getLatestGraphVersion: (artifactId: string) => {
          const state = get();
          const initialArtifact = state.artifacts.find(a => a.id === artifactId);
          
          if (!initialArtifact || (initialArtifact.type !== 'application/vnd.ant.knowledge-graph' && initialArtifact.type !== 'application/vnd.knowledge-graph')) {
            return null;
          }
          
          // Follow the chain to the latest version
          let latestArtifact = initialArtifact;
          let currentId = initialArtifact.nextVersionId;
          
          while (currentId) {
            const next = state.artifacts.find(a => a.id === currentId);
            if (!next) break;
            latestArtifact = next;
            currentId = next.nextVersionId;
          }
          
          return latestArtifact;
        },
        // Updated pinning functions
        pinArtifact: (id: string) => {
          // console.log('ChatStore: Pinning artifact:', id);
          set(state => {
            if (!state.pinnedArtifactIds.includes(id)) {
              return { pinnedArtifactIds: [...state.pinnedArtifactIds, id] };
            }
            return state;
          });
        },
        unpinArtifact: (id: string) => {
          // console.log('ChatStore: Unpinning artifact:', id);
          set(state => ({
            pinnedArtifactIds: state.pinnedArtifactIds.filter(pinnedId => pinnedId !== id)
          }));
        },
        toggleArtifactPin: (id: string) => {
          // console.log('ChatStore: Toggling artifact pin:', id);
          set(state => ({
            pinnedArtifactIds: state.pinnedArtifactIds.includes(id) 
              ? state.pinnedArtifactIds.filter(pinnedId => pinnedId !== id)
              : [...state.pinnedArtifactIds, id]
          }));
        },
        isPinnedArtifact: (id: string) => {
          return get().pinnedArtifactIds.includes(id);
        },
        getPinnedArtifacts: () => {
          return get().artifacts.filter(a => get().pinnedArtifactIds.includes(a.id));
        },
        clearPinnedArtifacts: () => {
          // console.log('ChatStore: Clearing all pinned artifacts');
          set({ pinnedArtifactIds: [] });
        },
        // Legacy function for backward compatibility with knowledge graph components
        setPinnedGraphId: (id: string | null) => {
          // console.log('ChatStore: Setting pinned graph ID to', id);
          const currentState = get();
          if (id === null) {
            // Unpin all knowledge graph artifacts
            const knowledgeGraphIds = currentState.artifacts
              .filter(a => a.type === 'application/vnd.knowledge-graph' || a.type === 'application/vnd.ant.knowledge-graph')
              .map(a => a.id);
            set(state => ({
              pinnedArtifactIds: state.pinnedArtifactIds.filter(pinnedId => !knowledgeGraphIds.includes(pinnedId))
            }));
          } else {
            // Pin the specific knowledge graph (replace any existing knowledge graph pins)
            const artifact = currentState.artifacts.find(a => a.id === id);
            if (artifact && (artifact.type === 'application/vnd.knowledge-graph' || artifact.type === 'application/vnd.ant.knowledge-graph')) {
              const knowledgeGraphIds = currentState.artifacts
                .filter(a => a.type === 'application/vnd.knowledge-graph' || a.type === 'application/vnd.ant.knowledge-graph')
                .map(a => a.id);
              set(state => ({
                pinnedArtifactIds: [
                  ...state.pinnedArtifactIds.filter(pinnedId => !knowledgeGraphIds.includes(pinnedId)),
                  id
                ]
              }));
            }
          }
        },
        // Computed property getter for backward compatibility
        get pinnedGraphId() {
          const currentState = get();
          const pinnedKnowledgeGraphs = currentState.artifacts.filter(a => 
            currentState.pinnedArtifactIds.includes(a.id) && 
            (a.type === 'application/vnd.knowledge-graph' || a.type === 'application/vnd.ant.knowledge-graph')
          );
          return pinnedKnowledgeGraphs.length > 0 ? pinnedKnowledgeGraphs[0].id : null;
        },
        toggleStatusUpdatesCollapsed: (messageId: string) => {
          set(state => {
            const updatedConversation = {
              ...state.conversations[state.currentConversationId!],
              messages: state.conversations[state.currentConversationId!].messages.map(msg =>
                msg.id === messageId ? 
                  { ...msg, statusUpdatesCollapsed: !msg.statusUpdatesCollapsed } : 
                  msg
              )
            };
            
            return {
              messages: updatedConversation.messages,
              conversations: {
                ...state.conversations,
                [state.currentConversationId!]: updatedConversation
              }
            };
          });
        },
        // Add new function to set project conversation flow state
        setProjectConversationFlow: (enabled: boolean) => {
          // console.log('ChatStore: Setting project conversation flow state:', enabled);
          set({ inProjectConversationFlow: enabled });
        },
      };
    },
    {
      name: 'chat-storage',
      partialize: (state) => ({
        conversations: state.conversations,
        currentConversationId: state.currentConversationId,
        messages: state.messages,
        artifacts: state.artifacts,
        pinnedArtifactIds: state.pinnedArtifactIds // Add pinned artifacts to persisted state
      })
    }
  )
);
