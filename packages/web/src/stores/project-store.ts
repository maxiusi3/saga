import { create } from 'zustand'
import { apiClient } from '@/lib/api'
import type { Project, Story, ProjectStats } from '@saga/shared/types'

interface ProjectState {
  projects: Project[]
  currentProject: Project | null
  stories: Story[]
  projectStats: ProjectStats | null
  isLoading: boolean
  error: string | null
}

interface ProjectActions {
  // Project management
  fetchProjects: () => Promise<void>
  fetchProject: (id: string) => Promise<void>
  createProject: (data: { title: string; description?: string }) => Promise<Project>
  updateProject: (id: string, data: { title?: string; description?: string }) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  
  // Project stats
  fetchProjectStats: (id: string) => Promise<void>
  
  // Story management
  fetchStories: (projectId: string, params?: { page?: number; limit?: number }) => Promise<void>
  fetchStory: (id: string) => Promise<Story>
  createStory: (projectId: string, formData: FormData) => Promise<Story>
  updateStory: (id: string, data: { title?: string; transcript?: string }) => Promise<void>
  deleteStory: (id: string) => Promise<void>
  searchStories: (projectId: string, query: string) => Promise<Story[]>
  
  // Invitations
  generateInvitation: (projectId: string, data: { email: string; role: 'facilitator' | 'storyteller'; message?: string }) => Promise<void>
  
  // Utility
  setCurrentProject: (project: Project | null) => void
  clearError: () => void
  setLoading: (loading: boolean) => void
}

type ProjectStore = ProjectState & ProjectActions

export const useProjectStore = create<ProjectStore>((set, get) => ({
  // Initial state
  projects: [],
  currentProject: null,
  stories: [],
  projectStats: null,
  isLoading: false,
  error: null,

  // Project management
  fetchProjects: async () => {
    set({ isLoading: true, error: null })
    
    try {
      const response = await apiClient.projects.list()
      const projects = response.data.data

      set({
        projects,
        isLoading: false,
        error: null,
      })
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to fetch projects',
      })
    }
  },

  fetchProject: async (id: string) => {
    set({ isLoading: true, error: null })
    
    try {
      const response = await apiClient.projects.get(id)
      const project = response.data.data

      set({
        currentProject: project,
        isLoading: false,
        error: null,
      })
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to fetch project',
      })
    }
  },

  createProject: async (data: { title: string; description?: string }) => {
    set({ isLoading: true, error: null })
    
    try {
      const response = await apiClient.projects.create(data)
      const newProject = response.data.data

      set((state) => ({
        projects: [newProject, ...state.projects],
        isLoading: false,
        error: null,
      }))

      return newProject
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to create project',
      })
      throw error
    }
  },

  updateProject: async (id: string, data: { title?: string; description?: string }) => {
    set({ isLoading: true, error: null })
    
    try {
      const response = await apiClient.projects.update(id, data)
      const updatedProject = response.data.data

      set((state) => ({
        projects: state.projects.map(p => p.id === id ? updatedProject : p),
        currentProject: state.currentProject?.id === id ? updatedProject : state.currentProject,
        isLoading: false,
        error: null,
      }))
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to update project',
      })
      throw error
    }
  },

  deleteProject: async (id: string) => {
    set({ isLoading: true, error: null })
    
    try {
      await apiClient.projects.delete(id)

      set((state) => ({
        projects: state.projects.filter(p => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject,
        isLoading: false,
        error: null,
      }))
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to delete project',
      })
      throw error
    }
  },

  // Project stats
  fetchProjectStats: async (id: string) => {
    try {
      const response = await apiClient.projects.stats(id)
      const stats = response.data.data

      set({
        projectStats: stats,
      })
    } catch (error: any) {
      console.error('Failed to fetch project stats:', error)
    }
  },

  // Story management
  fetchStories: async (projectId: string, params?: { page?: number; limit?: number }) => {
    set({ isLoading: true, error: null })
    
    try {
      const response = await apiClient.stories.list(projectId, params)
      const stories = response.data

      set({
        stories,
        isLoading: false,
        error: null,
      })
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to fetch stories',
      })
    }
  },

  fetchStory: async (id: string) => {
    try {
      const response = await apiClient.stories.get(id)
      return response.data.data
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Failed to fetch story')
    }
  },

  createStory: async (projectId: string, formData: FormData) => {
    set({ isLoading: true, error: null })
    
    try {
      const response = await apiClient.stories.create(projectId, formData)
      const newStory = response.data.data

      set((state) => ({
        stories: [newStory, ...state.stories],
        isLoading: false,
        error: null,
      }))

      return newStory
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to create story',
      })
      throw error
    }
  },

  updateStory: async (id: string, data: { title?: string; transcript?: string }) => {
    set({ isLoading: true, error: null })
    
    try {
      const response = await apiClient.stories.update(id, data)
      const updatedStory = response.data.data

      set((state) => ({
        stories: state.stories.map(s => s.id === id ? updatedStory : s),
        isLoading: false,
        error: null,
      }))
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to update story',
      })
      throw error
    }
  },

  deleteStory: async (id: string) => {
    set({ isLoading: true, error: null })
    
    try {
      await apiClient.stories.delete(id)

      set((state) => ({
        stories: state.stories.filter(s => s.id !== id),
        isLoading: false,
        error: null,
      }))
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to delete story',
      })
      throw error
    }
  },

  searchStories: async (projectId: string, query: string) => {
    try {
      const response = await apiClient.stories.search(projectId, query)
      return response.data.data.stories
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Failed to search stories')
    }
  },

  // Invitations
  generateInvitation: async (projectId: string, data: { email: string; role: 'facilitator' | 'storyteller'; message?: string }) => {
    set({ isLoading: true, error: null })
    
    try {
      await apiClient.projects.generateInvitation(projectId, data)
      
      set({
        isLoading: false,
        error: null,
      })
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error?.message || 'Failed to generate invitation',
      })
      throw error
    }
  },

  // Utility
  setCurrentProject: (project: Project | null) => {
    set({ currentProject: project })
  },

  clearError: () => {
    set({ error: null })
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading })
  },
}))

// Selectors
export const useCurrentProject = () => useProjectStore(state => state.currentProject)
export const useProjects = () => useProjectStore(state => state.projects)
export const useProjectLoading = () => useProjectStore(state => state.isLoading)
export const useProjectError = () => useProjectStore(state => state.error)