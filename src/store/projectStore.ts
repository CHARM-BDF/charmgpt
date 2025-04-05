import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface Project {
  id: string;
  name: string;
  description?: string;
  type: 'grant' | 'research';
  created: Date;
  lastModified: Date;
}

interface ProjectState {
  projects: Project[];
  selectedProjectId: string | null;
  createProject: (name: string, type: 'grant' | 'research', description?: string) => string;
  selectProject: (id: string | null) => void;
  getProject: (id: string) => Project | undefined;
  deleteProject: (id: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      selectedProjectId: null,

      createProject: (name, type, description) => {
        const newProject: Project = {
          id: uuidv4(),
          name,
          description,
          type,
          created: new Date(),
          lastModified: new Date()
        };

        set(state => ({
          projects: [...state.projects, newProject],
          selectedProjectId: newProject.id
        }));

        return newProject.id;
      },

      selectProject: (id) => {
        set({ selectedProjectId: id });
      },

      getProject: (id) => {
        return get().projects.find(p => p.id === id);
      },

      deleteProject: (id) => {
        set(state => ({
          projects: state.projects.filter(p => p.id !== id),
          selectedProjectId: state.selectedProjectId === id ? null : state.selectedProjectId
        }));
      }
    }),
    {
      name: 'project-storage'
    }
  )
); 