import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useChatStore } from './chatStore';

interface ProjectConversation {
  id: string;
  title: string;
  lastMessageAt: Date;
}

export interface ProjectFile {
  id: string;
  name: string;
  timestamp: Date;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  conversations: ProjectConversation[];
  files: ProjectFile[];
  type: 'project' | 'grant_review';
  grantMetadata?: {
    requiredDocuments: Array<{
      name: string;
      description: string;
      required: boolean;
      uploadStatus: 'pending' | 'uploaded' | 'reviewed';
    }>;
  };
}

interface ProjectState {
  projects: Project[];
  selectedProjectId: string | null;
  isLoading: boolean;
  error: string | null;

  // CRUD operations
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'conversations' | 'files'>) => string;
  updateProject: (id: string, updates: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'conversations' | 'files'>>) => void;
  deleteProject: (id: string) => void;
  selectProject: (id: string | null) => void;
  
  // Conversation management
  addConversationToProject: (projectId: string, conversationId: string, title: string) => void;
  removeConversationFromProject: (projectId: string, conversationId: string) => void;
  
  // File management
  addFileToProject: (projectId: string, fileId: string, name: string) => void;
  removeFileFromProject: (projectId: string, fileId: string) => void;

  // Loading and error states
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // Grant review specific
  getGrantReviewProjects: () => Project[];
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      selectedProjectId: null,
      isLoading: false,
      error: null,

      addProject: (projectData) => {
        console.log("ProjectStore: addProject called with data:", projectData);
        const projectId = crypto.randomUUID();
        console.log("ProjectStore: Generated new project ID:", projectId);
        
        set((state) => {
          console.log("ProjectStore: Current projects before adding:", state.projects.length);
          const newProject: Project = {
            id: projectId,
            ...projectData,
            type: projectData.type || 'project',
            grantMetadata: projectData.type === 'grant_review' ? {
              requiredDocuments: []
            } : undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
            conversations: [],
            files: [],
          };
          console.log("ProjectStore: Created new project object:", newProject);
          return {
            projects: [...state.projects, newProject],
            error: null,
          };
        });
        
        // Log state after update
        console.log("ProjectStore: After adding project, current state:", {
          projects: get().projects.length,
          selectedProjectId: get().selectedProjectId
        });
        console.log("ProjectStore: Returning project ID:", projectId);
        return projectId;
      },

      updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map((project) =>
          project.id === id
            ? { ...project, ...updates, updatedAt: new Date() }
            : project
        ),
        error: null,
      })),

      deleteProject: (id) => set((state) => ({
        projects: state.projects.filter((project) => project.id !== id),
        selectedProjectId: state.selectedProjectId === id ? null : state.selectedProjectId,
        error: null,
      })),

      selectProject: (id) => set({
        selectedProjectId: id,
        error: null,
      }),

      addConversationToProject: (projectId, conversationId, title) => {
        // First, update the project (existing logic)
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  conversations: [
                    ...(project.conversations || []),
                    {
                      id: conversationId,
                      title,
                      lastMessageAt: new Date(),
                    },
                  ],
                  updatedAt: new Date(),
                }
              : project
          ),
        }));
        
        // Then, update the conversation to reference this project
        useChatStore.getState().setConversationProject(conversationId, projectId);
      },

      removeConversationFromProject: (projectId, conversationId) => {
        // First update the project (existing logic)
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  conversations: project.conversations.filter((conv) => conv.id !== conversationId),
                  updatedAt: new Date(),
                }
              : project
          ),
        }));
        
        // Then, update the conversation to remove the project reference
        useChatStore.getState().setConversationProject(conversationId, undefined);
      },

      addFileToProject: (projectId, fileId, name) => set((state) => ({
        projects: state.projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                files: [
                  ...(project.files || []),
                  {
                    id: fileId,
                    name,
                    timestamp: new Date()
                  }
                ],
                updatedAt: new Date()
              }
            : project
        )
      })),

      removeFileFromProject: (projectId, fileId) => set((state) => ({
        projects: state.projects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                files: project.files.filter((file) => file.id !== fileId),
                updatedAt: new Date(),
              }
            : project
        ),
      })),

      setLoading: (isLoading) => set({
        isLoading,
        error: null,
      }),

      setError: (error) => set({
        error,
        isLoading: false,
      }),

      getGrantReviewProjects: () => {
        const state = get();
        return state.projects.filter(project => project.type === 'grant_review');
      },
    }),
    {
      name: 'project-storage',
      partialize: (state) => ({
        projects: state.projects,
        selectedProjectId: state.selectedProjectId,
      }),
    }
  )
); 