'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

interface RecommendationRequest {
  projectId?: string;
  limit?: number;
  excludeViewed?: boolean;
  categories?: string[];
}

interface RecommendedStory {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  duration?: number;
  facilitatorName: string;
  facilitatorId: string;
  categories: string[];
  tags: string[];
  thumbnailUrl?: string;
  chapterTitle?: string;
  score: number;
  reasoning: string[];
}

interface RecommendationResponse {
  recommendations: RecommendedStory[];
  algorithm: string;
  generatedAt: string;
}

export function useRecommendations(request: RecommendationRequest = {}) {
  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      
      if (request.projectId) queryParams.append('projectId', request.projectId);
      if (request.limit) queryParams.append('limit', request.limit.toString());
      if (request.excludeViewed !== undefined) queryParams.append('excludeViewed', request.excludeViewed.toString());
      if (request.categories?.length) queryParams.append('categories', request.categories.join(','));

      const response = await api.get(`/recommendations/stories?${queryParams.toString()}`);
      
      if (response.success) {
        setRecommendations(response.data);
      } else {
        setError(response.error || 'Failed to load recommendations');
      }
    } catch (err) {
      console.error('Recommendations fetch error:', err);
      setError('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, [request]);

  const trackInteraction = useCallback(async (
    storyId: string,
    action: 'click' | 'dismiss' | 'like' | 'dislike'
  ) => {
    try {
      await api.post('/recommendations/track', {
        storyId,
        action
      });
    } catch (err) {
      console.error('Failed to track recommendation interaction:', err);
      // Don't throw - analytics shouldn't break the main flow
    }
  }, []);

  const refreshRecommendations = useCallback(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return {
    recommendations,
    loading,
    error,
    refreshRecommendations,
    trackInteraction
  };
}