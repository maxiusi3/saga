'use client';

import { useState, useCallback } from 'react';
import { StoryShare, ShareStoryRequest } from '@saga/shared';

interface UseStorySharingReturn {
  shareStory: (storyId: string, request: ShareStoryRequest) => Promise<void>;
  getStoryShares: (storyId: string) => Promise<StoryShare[]>;
  getSharedStories: (userId: string, page?: number) => Promise<{
    stories: StoryShare[];
    total: number;
    hasMore: boolean;
  }>;
  isSharing: boolean;
  error: string | null;
}

export const useStorySharing = (): UseStorySharingReturn => {
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareStory = useCallback(async (storyId: string, request: ShareStoryRequest) => {
    setIsSharing(true);
    setError(null);

    try {
      const response = await fetch(`/api/stories/${storyId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to share story');
      }

      // Success - no need to return data for sharing
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to share story';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSharing(false);
    }
  }, []);

  const getStoryShares = useCallback(async (storyId: string): Promise<StoryShare[]> => {
    setError(null);

    try {
      const response = await fetch(`/api/stories/${storyId}/shares`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to get story shares');
      }

      const data = await response.json();
      return data.shares;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get story shares';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const getSharedStories = useCallback(async (
    userId: string, 
    page: number = 1
  ): Promise<{ stories: StoryShare[]; total: number; hasMore: boolean }> => {
    setError(null);

    try {
      const response = await fetch(`/api/users/${userId}/shared-stories?page=${page}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to get shared stories');
      }

      const data = await response.json();
      return {
        stories: data.stories,
        total: data.total,
        hasMore: data.hasMore
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get shared stories';
      setError(errorMessage);
      throw err;
    }
  }, []);

  return {
    shareStory,
    getStoryShares,
    getSharedStories,
    isSharing,
    error
  };
};