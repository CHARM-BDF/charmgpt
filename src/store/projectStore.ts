import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectState {
  projects: Project[];
  selectedProjectId: string | null;
  isLoading: boolean;
  error: string | null;

  // CRUD operations
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProject: (id: string, updates: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteProject: (id: string) => void;
  selectProject: (id: string | null) => void;
  
  // Loading and error states
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      selectedProjectId: null,
      isLoading: false,
      error: null,

      addProject: (projectData) => set((state) => {
        const newProject: Project = {
          id: crypto.randomUUID(),
          ...projectData,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        return {
          projects: [...state.projects, newProject],
          error: null,
        };
      }),

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

      setLoading: (isLoading) => set({
        isLoading,
        error: null,
      }),

      setError: (error) => set({
        error,
        isLoading: false,
      }),
    }),
    {
      name: 'project-storage',
      // Only persist the projects array and selectedProjectId
      partialize: (state) => ({
        projects: state.projects,
        selectedProjectId: state.selectedProjectId,
      }),
    }
  )
); 