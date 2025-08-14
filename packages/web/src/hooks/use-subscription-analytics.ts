'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface SubscriptionAnalytics {
  period: {
    start: Date;
    end: Date;
    daysRemaining: number;
    utilizationPercentage: number;
  };
  usage: {
    storiesRecorded: {
      current: number;
      previous: number;
      trend: 'up' | 'down' | 'stable';
      weeklyAverage: number;
    };
    interactionsCreated: {
      current: number;
      previous: number;
      trend: 'up' | 'down' | 'stable';
      weeklyAverage: number;
    };
    facilitatorsActive: {
      current: number;
      total: number;
      engagementRate: number;
    };
    storytellersActive: {
      current: number;
      total: number;
      engagementRate: number;
    };
  };
  engagement: {
    averageStoryLength: number;
    responseTime: number;
    chapterProgress: {
      completed: number;
      total: number;
      currentChapter: string;
    };
    peakActivityDays: string[];
    peakActivityHours: number[];
  };
  milestones: {
    id: string;
    title: string;
    description: string;
    achieved: boolean;
    achievedDate?: Date;
    progress?: number;
    target?: number;
  }[];
  insights: {
    type: 'positive' | 'neutral' | 'suggestion';
    title: string;
    description: string;
    actionable?: boolean;
    actionText?: string;
  }[];
  valueMetrics: {
    totalInvestment: number;
    costPerStory: number;
    costPerInteraction: number;
    projectedValue: number;
    currency: string;
  };
}

export interface AnalyticsFilters {
  period: 'week' | 'month' | 'quarter' | 'year' | 'all';
  startDate?: Date;
  endDate?: Date;
  includeArchived?: boolean;
}

interface UseSubscriptionAnalyticsOptions {
  projectId?: string;
  filters?: AnalyticsFilters;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseSubscriptionAnalyticsReturn {
  analytics: SubscriptionAnalytics | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateFilters: (filters: AnalyticsFilters) => void;
  exportReport: (format: 'pdf' | 'csv' | 'json') => Promise<void>;
  getDetailedMetrics: (metric: string) => Promise<any>;
}

export function useSubscriptionAnalytics(
  options: UseSubscriptionAnalyticsOptions = {}
): UseSubscriptionAnalyticsReturn {
  const { 
    projectId, 
    filters = { period: 'month' }, 
    autoRefresh = false, 
    refreshInterval = 300000 // 5 minutes
  } = options;

  const [analytics, setAnalytics] = useState<SubscriptionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<AnalyticsFilters>(filters);

  const fetchAnalytics = useCallback(async () => {
    try {
      setError(null);
      
      const endpoint = projectId 
        ? `/projects/${projectId}/analytics/subscription`
        : '/analytics/subscription';

      const response = await api.get(endpoint, {
        params: {
          period: currentFilters.period,
          startDate: currentFilters.startDate?.toISOString(),
          endDate: currentFilters.endDate?.toISOString(),
          includeArchived: currentFilters.includeArchived
        }
      });

      if (response.data.success) {
        const data = response.data.data;
        
        // Transform dates
        const transformedAnalytics: SubscriptionAnalytics = {
          ...data,
          period: {
            ...data.period,
            start: new Date(data.period.start),
            end: new Date(data.period.end)
          },
          milestones: data.milestones.map((milestone: any) => ({
            ...milestone,
            achievedDate: milestone.achievedDate ? new Date(milestone.achievedDate) : undefined
          }))
        };

        setAnalytics(transformedAnalytics);
      } else {
        setError(response.data.error?.message || 'Failed to fetch analytics');
      }
    } catch (err: any) {
      console.error('Error fetching subscription analytics:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [projectId, currentFilters]);

  const updateFilters = useCallback((newFilters: AnalyticsFilters) => {
    setCurrentFilters(newFilters);
  }, []);

  const exportReport = useCallback(async (format: 'pdf' | 'csv' | 'json') => {
    try {
      const endpoint = projectId 
        ? `/projects/${projectId}/analytics/subscription/export`
        : '/analytics/subscription/export';

      const response = await api.get(endpoint, {
        params: {
          format,
          period: currentFilters.period,
          startDate: currentFilters.startDate?.toISOString(),
          endDate: currentFilters.endDate?.toISOString(),
          includeArchived: currentFilters.includeArchived
        },
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const filename = `subscription-analytics-${currentFilters.period}.${format}`;
      link.setAttribute('download', filename);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (err: any) {
      console.error('Error exporting analytics report:', err);
      setError(err.response?.data?.error?.message || 'Failed to export report');
    }
  }, [projectId, currentFilters]);

  const getDetailedMetrics = useCallback(async (metric: string) => {
    try {
      const endpoint = projectId 
        ? `/projects/${projectId}/analytics/subscription/${metric}`
        : `/analytics/subscription/${metric}`;

      const response = await api.get(endpoint, {
        params: {
          period: currentFilters.period,
          startDate: currentFilters.startDate?.toISOString(),
          endDate: currentFilters.endDate?.toISOString()
        }
      });

      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.error?.message || 'Failed to fetch detailed metrics');
      }
    } catch (err: any) {
      console.error('Error fetching detailed metrics:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch detailed metrics');
      throw err;
    }
  }, [projectId, currentFilters]);

  // Initial fetch
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchAnalytics, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchAnalytics]);

  return {
    analytics,
    loading,
    error,
    refresh: fetchAnalytics,
    updateFilters,
    exportReport,
    getDetailedMetrics
  };
}

// Hook for getting analytics across all user's projects
export function useUserAnalyticsSummary() {
  const [summary, setSummary] = useState<{
    totalProjects: number;
    activeSubscriptions: number;
    totalStoriesRecorded: number;
    totalInteractions: number;
    totalInvestment: number;
    averageEngagement: number;
    topPerformingProject: {
      id: string;
      name: string;
      storiesCount: number;
      engagementRate: number;
    };
    currency: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/analytics/user-summary');

      if (response.data.success) {
        setSummary(response.data.data);
      } else {
        setError(response.data.error?.message || 'Failed to fetch user summary');
      }
    } catch (err: any) {
      console.error('Error fetching user analytics summary:', err);
      setError(err.response?.data?.error?.message || 'Failed to fetch user summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    summary,
    loading,
    error,
    refresh: fetchSummary
  };
}

// Hook for tracking user analytics events
export function useAnalyticsTracking() {
  const trackEvent = useCallback(async (
    event: string,
    properties?: Record<string, any>,
    projectId?: string
  ) => {
    try {
      await api.post('/analytics/events', {
        event,
        properties,
        projectId,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      // Don't throw errors for analytics tracking
      console.warn('Failed to track analytics event:', err);
    }
  }, []);

  const trackSubscriptionEvent = useCallback(async (
    event: 'viewed_analytics' | 'exported_report' | 'viewed_details' | 'changed_filters',
    projectId: string,
    metadata?: Record<string, any>
  ) => {
    await trackEvent(`subscription_analytics_${event}`, {
      ...metadata,
      projectId
    }, projectId);
  }, [trackEvent]);

  return {
    trackEvent,
    trackSubscriptionEvent
  };
}

export default useSubscriptionAnalytics;