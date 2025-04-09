import { Project } from '../store/projectStore';

interface ProjectCreateData {
  name: string;
  description: string;
}

interface ProjectUpdateData {
  name?: string;
  description?: string;
}

class ProjectService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/projects';
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  async listProjects(): Promise<Project[]> {
    try {
      const response = await fetch(this.baseUrl);
      return this.handleResponse<Project[]>(response);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      throw error;
    }
  }

  async createProject(data: ProjectCreateData): Promise<Project> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return this.handleResponse<Project>(response);
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  }

  async updateProject(id: string, data: ProjectUpdateData): Promise<Project> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return this.handleResponse<Project>(response);
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  }

  async deleteProject(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
      });
      await this.handleResponse<void>(response);
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  }
}

export const projectService = new ProjectService(); 