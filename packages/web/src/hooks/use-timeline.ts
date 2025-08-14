'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

interface TimelineFilters {
  startDate?: string;
  endDate?: string;
  categories?: string[];
  tags?: string[];
  facilitators?: string[];
  projectId?: string;
}

interface TimelineStory {
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
  position: {
    x: number;
    y: number;
  };
}

interface TimelineResponse {
  stories: TimelineStory[];
  dateRange: {
    start: string;
    end: string;
  };
  totalCount: number;
  categories: Array<{ name: string; count: number; color: string }>;
  facilitators: Array<{ id: string; name: string; count: number }>;
}

export function useTimeline(filters: TimelineFilters = {}) {
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.categories?.length) queryParams.append('categories', filters.categories.join(','));
      if (filters.tags?.length) queryParams.append('tags', filters.tags.join(','));
      if (filters.facilitators?.length) queryParams.append('facilitators', filters.facilitators.join(','));
      if (filters.projectId) queryParams.append('projectId', filters.projectId);

      const response = await api.get(`/timeline?${queryParams.toString()}`);
      
      if (response.success) {
        setTimeline(response.data);
      } else {
        setError(response.error || 'Failed to load timeline');
      }
    } catch (err) {
      console.error('Timeline fetch error:', err);
      setError('Failed to load timeline data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const trackInteraction = useCallback(async (
    action: 'view' | 'filter' | 'click_story',
    metadata: Record<string, any> = {}
  ) => {
    try {
      await api.post('/timeline/track', {
        action,
        metadata
      });
    } catch (err) {
      console.error('Failed to track timeline interaction:', err);
      // Don't throw - analytics shouldn't break the main flow
    }
  }, []);

  const refreshTimeline = useCallback(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  return {
    timeline,
    loading,
    error,
    refreshTimeline,
    trackInteraction
  };
}