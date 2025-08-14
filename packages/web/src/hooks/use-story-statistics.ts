'use client';

import { useState, useEffect, useCallback } from 'react';
import { StoryStatistics, StoryQualityMetrics, CompletionTracking } from '@saga/shared';

interface UseStoryStatisticsReturn {
  statistics: StoryStatistics | null;
  qualityMetrics: Record<string, StoryQualityMetrics>;
  completionData: CompletionTracking | null;
  isLoading: boolean;
  error: string | null;
  refreshStatistics: () => Promise<void>;
  getStoryQuality: (storyId: string) => Promise<StoryQualityMetrics>;
  getBatchQuality: (storyIds: string[]) => Promise<StoryQualityMetrics[]>;
}

export const useStoryStatistics = (projectId: string): UseStoryStatisticsReturn => {
  const [statistics, setStatistics] = useState<StoryStatistics | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<Record<string, StoryQualityMetrics>>({});
  const [completionData, setCompletionData] = useState<CompletionTracking | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatistics = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/statistics`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch statistics');
      }

      const data = await response.json();
      setStatistics(data.statistics);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch statistics';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const fetchCompletionData = useCallback(async () => {
    if (!projectId) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/completion`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch completion data');
      }

      const data = await response.json();
      setCompletionData(data.completion);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch completion data';
      setError(errorMessage);
    }
  }, [projectId]);

  const getStoryQuality = useCallback(async (storyId: string): Promise<StoryQualityMetrics> => {
    // Check if we already have this quality data
    if (qualityMetrics[storyId]) {
      return qualityMetrics[storyId];
    }

    try {
      const response = await fetch(`/api/stories/${storyId}/quality`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch story quality');
      }

      const data = await response.json();
      const quality = data.quality;

      // Cache the result
      setQualityMetrics(prev => ({
        ...prev,
        [storyId]: quality
      }));

      return quality;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch story quality';
      setError(errorMessage);
      throw err;
    }
  }, [qualityMetrics]);

  const getBatchQuality = useCallback(async (storyIds: string[]): Promise<StoryQualityMetrics[]> => {
    // Filter out stories we already have quality data for
    const uncachedIds = storyIds.filter(id => !qualityMetrics[id]);
    
    if (uncachedIds.length === 0) {
      return storyIds.map(id => qualityMetrics[id]);
    }

    try {
      const response = await fetch('/api/stories/quality/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storyIds: uncachedIds }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch batch quality');
      }

      const data = await response.json();
      const newMetrics = data.qualityMetrics;

      // Cache the new results
      const metricsMap = newMetrics.reduce((acc: Record<string, StoryQualityMetrics>, metric: StoryQualityMetrics) => {
        acc[metric.storyId] = metric;
        return acc;
      }, {});

      setQualityMetrics(prev => ({
        ...prev,
        ...metricsMap
      }));

      // Return all requested metrics (cached + new)
      return storyIds.map(id => qualityMetrics[id] || metricsMap[id]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch batch quality';
      setError(errorMessage);
      throw err;
    }
  }, [qualityMetrics]);

  const refreshStatistics = useCallback(async () => {
    await Promise.all([
      fetchStatistics(),
      fetchCompletionData()
    ]);
  }, [fetchStatistics, fetchCompletionData]);

  // Initial load
  useEffect(() => {
    refreshStatistics();
  }, [refreshStatistics]);

  return {
    statistics,
    qualityMetrics,
    completionData,
    isLoading,
    error,
    refreshStatistics,
    getStoryQuality,
    getBatchQuality
  };
};