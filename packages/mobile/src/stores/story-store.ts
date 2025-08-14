import { create } from 'zustand';
import { ApiClient } from '../services/api-client';
import type { Story, CreateStoryInput, PaginatedStories } from '@saga/shared/types/story';
import type { Interaction } from '@saga/shared/types/interaction';

interface StoryState {
  stories: Story[];
  currentStory: Story | null;
  interactions: Interaction[];
  unreadInteractions: Interaction[];
  isLoading: boolean;
  error: string | null;
  uploadProgress: number;
  searchQuery: string;
  hasMore: boolean;
  currentPage: number;
}

interface StoryActions {
  fetchStories: (page?: number, search?: string) => Promise<void>;
  fetchStoryById: (id: string) => Promise<void>;
  fetchStoryInteractions: (storyId: string) => Promise<void>;
  fetchUnreadInteractions: () => Promise<void>;
  createStory: (data: CreateStoryInput) => Promise<Story>;
  uploadAudio: (storyId: string, audioUri: string, onProgress?: (progress: number) => void) => Promise<void>;
  updateTranscript: (storyId: string, transcript: string) => Promise<void>;
  markInteractionAsRead: (interactionId: string) => Promise<void>;
  searchStories: (query: string) => Promise<void>;
  clearSearch: () => void;
  clearError: () => void;
  setUploadProgress: (progress: number) => void;
  refreshStories: () => Promise<void>;
}

export const useStoryStore = create<StoryState & StoryActions>((set, get) => ({
  // State
  stories: [],
  currentStory: null,
  interactions: [],
  unreadInteractions: [],
  isLoading: false,
  error: null,
  uploadProgress: 0,
  searchQuery: '',
  hasMore: true,
  currentPage: 1,

  // Actions
  fetchStories: async (page = 1, search = '') => {
    try {
      const state = get();
      const isNewSearch = search !== state.searchQuery;
      const isFirstPage = page === 1;
      
      set({ 
        isLoading: true, 
        error: null,
        ...(isNewSearch && { searchQuery: search }),
        ...(isFirstPage && { currentPage: 1 })
      });
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
      });
      
      const response = await ApiClient.get(`/stories?${params}`);
      const data: PaginatedStories = response.data;
      
      set((state) => ({
        stories: isFirstPage ? data.stories : [...state.stories, ...data.stories],
        hasMore: data.hasMore,
        currentPage: page,
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch stories',
        isLoading: false,
      });
    }
  },

  fetchStoryById: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      
      const response = await ApiClient.get(`/stories/${id}`);
      const story = response.data;
      
      set({ currentStory: story, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch story',
        isLoading: false,
      });
    }
  },

  fetchStoryInteractions: async (storyId: string) => {
    try {
      set({ error: null });
      
      const response = await ApiClient.get(`/stories/${storyId}/interactions`);
      const interactions = response.data;
      
      set({ interactions });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch interactions',
      });
    }
  },

  fetchUnreadInteractions: async () => {
    try {
      set({ error: null });
      
      const response = await ApiClient.get('/interactions/unread');
      const unreadInteractions = response.data;
      
      set({ unreadInteractions });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch unread interactions',
      });
    }
  },

  createStory: async (data: CreateStoryInput) => {
    try {
      set({ isLoading: true, error: null });
      
      const response = await ApiClient.post('/stories', data);
      const story = response.data;
      
      set((state) => ({
        stories: [story, ...state.stories],
        isLoading: false,
      }));
      
      return story;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to create story',
        isLoading: false,
      });
      throw error;
    }
  },

  uploadAudio: async (storyId: string, audioUri: string, onProgress?: (progress: number) => void) => {
    try {
      set({ error: null, uploadProgress: 0 });
      
      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);

      await ApiClient.post(`/stories/${storyId}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          set({ uploadProgress: progress });
          onProgress?.(progress);
        },
      });

      set({ uploadProgress: 100 });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to upload audio',
        uploadProgress: 0,
      });
      throw error;
    }
  },

  updateTranscript: async (storyId: string, transcript: string) => {
    try {
      set({ error: null });
      
      await ApiClient.patch(`/stories/${storyId}/transcript`, { transcript });
      
      // Update the story in local state
      set((state) => ({
        stories: state.stories.map((story) =>
          story.id === storyId ? { ...story, transcript } : story
        ),
        currentStory: state.currentStory?.id === storyId 
          ? { ...state.currentStory, transcript }
          : state.currentStory,
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to update transcript',
      });
      throw error;
    }
  },

  markInteractionAsRead: async (interactionId: string) => {
    try {
      await ApiClient.patch(`/interactions/${interactionId}/read`);
      
      set((state) => ({
        unreadInteractions: state.unreadInteractions.filter(
          (interaction) => interaction.id !== interactionId
        ),
      }));
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to mark interaction as read',
      });
    }
  },

  searchStories: async (query: string) => {
    await get().fetchStories(1, query);
  },

  clearSearch: () => {
    set({ searchQuery: '' });
    get().fetchStories(1, '');
  },

  refreshStories: async () => {
    const { searchQuery } = get();
    await get().fetchStories(1, searchQuery);
  },

  clearError: () => set({ error: null }),
  
  setUploadProgress: (progress: number) => set({ uploadProgress: progress }),
}));