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
  pinnedGraphId: string | null;
  chatInput: string; // New state for chat input
  inProjectConversationFlow: boolean; // Flag to track if we're continuing a project conversation
  
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
  setPinnedGraphId: (id: string | null) => void;
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
        pinnedGraphId: null,
        chatInput: '', // Initialize chat input
        inProjectConversationFlow: false, // Initialize the project conversation flow flag
        
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
          console.log('ChatStore: Migrating conversation-project associations');
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

          // Create default conversation if none exists
          if (!state.currentConversationId) {
            const conversationId = get().startNewConversation();
            state = get(); // Get updated state after creating conversation
          }

          const updatedConversation = {
            ...state.conversations[state.currentConversationId!],
            messages: [...state.conversations[state.currentConversationId!].messages, newMessage],
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
            }
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
          console.log('ChatStore: Processing message:', content);
          
          set({ isLoading: true, error: null });
          
          try {
            // Helper function to send status updates
            const sendStatusUpdate = (status: string) => {
              set((state: ChatState) => ({
                messages: state.messages.map(msg => {
                  if (msg.id === assistantMessageId) {
                    const updatedMsg: MessageWithThinking = {
                      ...msg,
                      statusUpdates: [
                        ...((msg.statusUpdates || []) as StatusUpdate[]),
                        {
                          id: crypto.randomUUID(),
                          message: status,
                          timestamp: new Date()
                        }
                      ]
                    };
                    return updatedMsg;
                  }
                  return msg;
                }),
                streamingContent: `_Status: ${status}_\n\n`
              }));
            };

            // Process incoming status update from server
            const processStatusUpdate = (data: { message: string; id?: string; timestamp?: string }) => {
              set((state: ChatState) => {
                const assistantMessage = state.messages.find(msg => msg.id === assistantMessageId);
                console.log(`[ID DEBUG] In processStatusUpdate, found message: ${assistantMessage?.id === assistantMessageId ? 'MATCH' : 'NO MATCH'}`);
                console.log(`[STATUS DEBUG] Processing update: "${data.message}"`);
                console.log(`[STATUS DEBUG] Current message has ${assistantMessage?.statusUpdates?.length || 0} existing updates`);
                
                // Create new status update
                const newUpdate: StatusUpdate = {
                  id: data.id || crypto.randomUUID(),
                  message: data.message,
                  timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
                };
                
                // Update the messages with the new status update
                const updatedMessages = state.messages.map(msg => {
                  if (msg.id === assistantMessageId) {
                    const existingUpdates = Array.isArray(msg.statusUpdates) ? msg.statusUpdates : [];
                    console.log(`[STATUS DEBUG] Adding update to list of ${existingUpdates.length} updates`);
                    
                    return {
                      ...msg,
                      statusUpdates: [...existingUpdates, newUpdate],
                      statusUpdatesCollapsed: false, // Always keep expanded during streaming
                      isLastStatusUpdate: data.message === 'Finalizing response...' // Flag the final update
                    } as MessageWithThinking;
                  }
                  return msg;
                });
                
                return {
                  messages: updatedMessages
                };
              });
            };

            // Get the selected model from the correct store
            const selectedModel = useModelStore.getState().selectedModel;
            console.log('ChatStore: Using model:', selectedModel);
            
            // Choose the appropriate API endpoint based on the model
            const endpoint = selectedModel === 'ollama' ? API_ENDPOINTS.OLLAMA : API_ENDPOINTS.CHAT;
            const apiUrl = getApiUrl(endpoint);

            // Create assistant message for status updates
            const assistantMessageId = crypto.randomUUID();
            const assistantMessage: MessageWithThinking = {
              role: 'assistant',
              content: '_Status: Initializing..._',
              id: assistantMessageId,
              timestamp: new Date(),
              statusUpdatesCollapsed: true, // Default to collapsed
              statusUpdates: [] // Initialize with empty array
            };

            // Add assistant message to current conversation
            set(state => {
              // Get the current project conversation flow state to preserve it
              const currentInProjectConversationFlow = state.inProjectConversationFlow;
              
              const updatedConversation = {
                ...state.conversations[state.currentConversationId!],
                messages: [...state.conversations[state.currentConversationId!].messages, assistantMessage],
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
                streamingMessageId: assistantMessageId,
                streamingContent: '_Status: Initializing..._\n\n',
                inProjectConversationFlow: currentInProjectConversationFlow // Preserve the flag
              };
            });

            // After creating the assistant message
            console.log(`[ID DEBUG] Initial assistantMessageId: ${assistantMessageId}`);
            
            // Get pinned graph if available
            const pinnedGraphId = get().pinnedGraphId;
            let pinnedGraph = null;
            
            if (pinnedGraphId) {
              sendStatusUpdate('Retrieving pinned knowledge graph...');
              const pinnedArtifact = get().artifacts.find(a => a.id === pinnedGraphId);
              if (pinnedArtifact) {
                console.log('ChatStore: Including pinned graph in message:', pinnedGraphId);
                pinnedGraph = pinnedArtifact;
                sendStatusUpdate('Knowledge graph retrieved');
              }
            }

            // Get all messages for the history
            sendStatusUpdate('Preparing message history...');
            const messageHistory = get().messages
              .filter(msg => msg.content.trim() !== '')
              .map(msg => ({
                role: msg.role,
                content: msg.content
              }));

            sendStatusUpdate('Connecting to MCP server...');
            
            // Add extensive debug logging
            const blockedServersToSend = useMCPStore.getState().getBlockedServers();
            console.log('\n=== DEBUG: SENDING BLOCKED SERVERS TO API ===');
            console.log('blockedServers value being sent in request:', blockedServersToSend);
            console.log('blockedServers JSON stringified:', JSON.stringify(blockedServersToSend));
            console.log('Type of blockedServers:', Array.isArray(blockedServersToSend) ? 'Array' : typeof blockedServersToSend);
            console.log('Number of blocked servers:', blockedServersToSend.length);
            
            // Check if getBlockedServers actually works
            const mcpStore = useMCPStore.getState();
            console.log('Direct check of MCP store:');
            if (mcpStore.servers && Array.isArray(mcpStore.servers)) {
              const blockedServersDirectCheck = mcpStore.servers
                .filter(server => server.status === 'blocked')
                .map(server => server.name);
              console.log('- Blocked servers by direct check:', blockedServersDirectCheck);
              console.log('- Number of blocked servers by direct check:', blockedServersDirectCheck.length);
              
              if (JSON.stringify(blockedServersToSend) !== JSON.stringify(blockedServersDirectCheck)) {
                console.warn('⚠️ DISCREPANCY DETECTED between getBlockedServers() and direct check!');
              }
            }
            
            // Check stringified request body
            const requestBody = JSON.stringify({
              message: content,
              history: messageHistory,
              blockedServers: blockedServersToSend,
              pinnedGraph: pinnedGraph
            });
            
            console.log('Full request body stringified:', requestBody);
            console.log('Parsing request body back:', JSON.parse(requestBody).blockedServers);
            console.log('=== END DEBUG ===\n');
            
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: requestBody
            });

            if (!response.ok) {
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
                break;
              }
              
              // Decode the chunk and add to buffer
              buffer += decoder.decode(value, { stream: true });
              
              // Process complete JSON objects
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep the last potentially incomplete line in the buffer
              
              for (const line of lines) {
                if (!line.trim()) continue;
                
                try {
                  const data = JSON.parse(line);
                  console.log('[STREAM DEBUG] Received chunk type:', data.type);
                  
                  if (data.type === 'status') {
                    // Update the message with the status
                    console.log('[STREAM DEBUG] Processing status update:', data.message);
                    processStatusUpdate(data);
                  } 
                  else if (data.type === 'result') {
                    // Store the final response for processing after the loop
                    console.log('[STREAM DEBUG] Received final result');
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
              console.log(`[FINAL DEBUG] Processing final response`);
              const startTime = Date.now();
              
              // CRITICAL: Capture status updates BEFORE artifact processing
              const beforeFinalMsg = get().messages.find(msg => msg.id === assistantMessageId);
              console.log(`[FINAL DEBUG] Before processing final: Message has ${beforeFinalMsg?.statusUpdates?.length || 0} status updates`);
              
              // Save ALL status updates right away
              const savedStatusUpdates = beforeFinalMsg?.statusUpdates || [];
              console.log(`[FINAL DEBUG] Saved ${savedStatusUpdates.length} status updates before any processing`);
              
              const storeResponse = finalResponse;

              // Log the storeResponse structure 
              console.log(`[FINAL DEBUG] storeResponse keys:`, Object.keys(storeResponse));
              console.log(`[FINAL DEBUG] storeResponse has thinking:`, !!storeResponse.thinking);
              console.log(`[FINAL DEBUG] storeResponse has conversation:`, !!storeResponse.conversation);
              
              // Inspect the top-level conversation structure
              if (typeof storeResponse.conversation === 'string') {
                console.log(`[FINAL DEBUG] storeResponse.conversation is a string of length:`, storeResponse.conversation.length);
              } else if (storeResponse.conversation) {
                console.log(`[FINAL DEBUG] storeResponse.conversation type:`, typeof storeResponse.conversation);
              }

              let fullContent = '';
              if (typeof storeResponse.conversation === 'string') {
                fullContent = storeResponse.conversation;
              }

              // Update assistant message with thinking
              sendStatusUpdate('Processing artifacts...');
              
              // Check all messages to ensure our ID is still valid
              console.log(`[ID DEBUG] Before artifact processing - assistantMessageId: ${assistantMessageId}`);
              const allMessages = get().messages;
              const messageIds = allMessages.map(msg => msg.id);
              console.log(`[ID DEBUG] Available message IDs in state:`, messageIds);
              const messageIndex = messageIds.indexOf(assistantMessageId);
              console.log(`[ID DEBUG] Message index in array: ${messageIndex}`);
              
              // Update the message with thinking first
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
              
              // Final status update
              sendStatusUpdate('Finalizing response...');
              
              // When ready to do final update, use our previously saved status updates
              const currentMsg = get().messages.find(msg => msg.id === assistantMessageId);
              console.log(`[ID DEBUG] After artifact processing - currentMsg found: ${currentMsg ? 'YES' : 'NO'}, id: ${currentMsg?.id}`);
              console.log(`[ID DEBUG] Current messages in state:`, get().messages.map(msg => msg.id));
              console.log(`[STATUS DEBUG] ---- FINAL RESPONSE HANDLING ----`);
              console.log(`[STATUS DEBUG] Current message has ${currentMsg?.statusUpdates?.length || 0} status updates`);
              console.log(`[STATUS DEBUG] Original preserved updates: ${savedStatusUpdates.length}`);
              
              // Merge in any new updates that were added during artifact processing
              const finalStatusUpdates = [...savedStatusUpdates];
              
              // Add any new updates that might have been added after we preserved savedStatusUpdates
              if (currentMsg?.statusUpdates && currentMsg.statusUpdates.length > 0) {
                const lastPreservedTime = savedStatusUpdates.length > 0 
                  ? savedStatusUpdates[savedStatusUpdates.length - 1].timestamp.getTime() 
                  : 0;
                
                const newUpdates = currentMsg.statusUpdates.filter(update => {
                  const updateTime = update.timestamp instanceof Date 
                    ? update.timestamp.getTime() 
                    : new Date(update.timestamp).getTime();
                  return updateTime > lastPreservedTime;
                });
                
                if (newUpdates.length > 0) {
                  console.log(`[STATUS DEBUG] Adding ${newUpdates.length} new updates that occurred during artifact processing`);
                  finalStatusUpdates.push(...newUpdates);
                }
              }
              
              // Use the merged list of status updates for the final message
              const existingStatusUpdates = finalStatusUpdates;
              
              set(state => {
                const messagesInState = state.conversations[state.currentConversationId!].messages;
                console.log(`[ID DEBUG] Messages in state during update:`, messagesInState.map(msg => msg.id));
                console.log(`[ID DEBUG] Looking for message with ID: ${assistantMessageId}`);
                
                // Get the current project conversation flow state to preserve it
                const currentInProjectConversationFlow = state.inProjectConversationFlow;
                
                const updatedMessages = messagesInState.map(msg => {
                  if (msg.id === assistantMessageId) {
                    console.log(`[ID DEBUG] Found message to update! ID: ${msg.id}`);
                    console.log(`[FINAL DEBUG] Found message to update. Using all ${existingStatusUpdates.length} preserved updates.`);
                    
                    return {
                      ...msg,
                      statusUpdates: existingStatusUpdates,
                      content: fullContent,
                      thinking: storeResponse.thinking,
                      artifactId: artifactIds[0],
                      artifactIds: artifactIds.length > 0 ? artifactIds : undefined
                    };
                  }
                  return msg;
                });
                
                // Check if the message was actually updated
                const updatedMessage = updatedMessages.find(msg => msg.id === assistantMessageId);
                console.log(`[ID DEBUG] After mapping - updated message found: ${updatedMessage ? 'YES' : 'NO'}`);
                if (updatedMessage) {
                  console.log(`[ID DEBUG] Final status updates length: ${updatedMessage.statusUpdates?.length || 0}`);
                }
                
                const updatedConversation = {
                  ...state.conversations[state.currentConversationId!],
                  messages: updatedMessages
                };
                
                console.log('ChatStore: Updated message with artifact references:', {
                  messageId: assistantMessageId,
                  primaryArtifactId: artifactIds[0],
                  allArtifactIds: artifactIds,
                  totalArtifacts: artifactIds.length,
                  contentLength: fullContent.length,
                  statusUpdatesLength: Array.isArray(existingStatusUpdates) ? existingStatusUpdates.length : 0
                });

                return {
                  messages: updatedConversation.messages,
                  conversations: {
                    ...state.conversations,
                    [state.currentConversationId!]: updatedConversation
                  },
                  streamingMessageId: null,
                  streamingContent: fullContent,
                  streamingComplete: true,
                  inProjectConversationFlow: currentInProjectConversationFlow // Preserve the flag
                };
              });

              set({ isLoading: false });
              
            }

          } catch (error) {
            console.error('ChatStore: Error processing message:', error);
            
            // Get the current project conversation flow state to preserve it
            const currentInProjectConversationFlow = get().inProjectConversationFlow;
            
            set({ 
              error: error instanceof Error ? error.message : 'Unknown error',
              isLoading: false,
              streamingMessageId: null,
              streamingContent: '',
              streamingComplete: true,
              inProjectConversationFlow: currentInProjectConversationFlow // Preserve the flag
            });
            
            // Update the message to show the error
            const errorMessageId = get().streamingMessageId;
            if (errorMessageId) {
              set(state => ({
                messages: state.messages.map(msg =>
                  msg.id === errorMessageId ? 
                    { ...msg, content: `_Error: ${error instanceof Error ? error.message : 'Unknown error'}_` } : 
                    msg
                ),
                inProjectConversationFlow: state.inProjectConversationFlow // Preserve the flag
              }));
            }
          }
        },

        clearChat: () => set(_state => ({
          messages: [],
          selectedArtifactId: null,
          artifacts: [],
          isLoading: false,
          error: null,
          showArtifactWindow: false,
          inProjectConversationFlow: false // Reset the flag when clearing chat
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
            inProjectConversationFlow: false // Reset project conversation flow when starting a new conversation
          }));
          
          return id;
        },

        switchConversation: (id: string) => {
          const state = get();
          const conversation = state.conversations[id];
          if (!conversation) return;

          // Check if this conversation belongs to any project directly from its metadata
          // instead of querying the project store which could cause circular dependencies
          const isProjectConversation = !!conversation.metadata.projectId;
          console.log('ChatStore: Switching to conversation:', id, 'Project conversation:', isProjectConversation);

          set({
            currentConversationId: id,
            messages: conversation.messages,
            artifacts: conversation.artifacts || [],
            selectedArtifactId: null,
            showArtifactWindow: false,
            inProjectConversationFlow: isProjectConversation // Set true if conversation belongs to a project
          });
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
            console.error('updateGraphArtifact: Base artifact not found or not a knowledge graph');
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
            console.error('updateGraphArtifact: Failed to update graph:', error);
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
        setPinnedGraphId: (id: string | null) => {
          console.log('ChatStore: Setting pinned graph ID to', id);
          set({ pinnedGraphId: id });
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
          console.log('ChatStore: Setting project conversation flow state:', enabled);
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
        artifacts: state.artifacts
      })
    }
  )
);
